package main

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"io"
	"log"
	"net/http"
	"os"
	"strings"
	"time"

	"github.com/google/uuid"
	"github.com/jackc/pgx/v5/pgxpool"
	"github.com/joho/godotenv"
)

type userRow struct {
	ID   uuid.UUID
	Name string
}

type geminiRequest struct {
	Contents []geminiContent `json:"contents"`
}

type geminiContent struct {
	Parts []geminiPart `json:"parts"`
}

type geminiPart struct {
	Text string `json:"text"`
}

type geminiResponse struct {
	Candidates []struct {
		Content struct {
			Parts []struct {
				Text string `json:"text"`
			} `json:"parts"`
		} `json:"content"`
	} `json:"candidates"`
}

type nameGender struct {
	Name   string `json:"name"`
	Gender string `json:"gender"`
}

func main() {
	_ = godotenv.Load()

	apiKey := os.Getenv("GEMINI_API_KEY")
	if apiKey == "" {
		log.Fatal("GEMINI_API_KEY environment variable is required")
	}

	dbURL := os.Getenv("DATABASE_URL")
	if dbURL == "" {
		log.Fatal("DATABASE_URL environment variable is required")
	}

	ctx := context.Background()

	pool, err := pgxpool.New(ctx, dbURL)
	if err != nil {
		log.Fatalf("Failed to connect to database: %v", err)
	}
	defer pool.Close()

	if err := pool.Ping(ctx); err != nil {
		log.Fatalf("Failed to ping database: %v", err)
	}
	log.Println("Connected to database")

	users, err := fetchUsersWithoutGender(ctx, pool)
	if err != nil {
		log.Fatalf("Failed to fetch users: %v", err)
	}

	log.Printf("Found %d users without gender", len(users))

	if len(users) == 0 {
		log.Println("No users to process")
		return
	}

	batchSize := 50
	var totalMale, totalFemale, totalUnknown int

	for i := 0; i < len(users); i += batchSize {
		end := i + batchSize
		if end > len(users) {
			end = len(users)
		}
		batch := users[i:end]

		log.Printf("Processing batch %d-%d of %d...", i+1, end, len(users))

		results, err := classifyNames(apiKey, batch)
		if err != nil {
			log.Printf("ERROR classifying batch %d-%d: %v (skipping)", i+1, end, err)
			continue
		}

		for _, user := range batch {
			gender := lookupGender(results, user.Name)
			if err := updateUserGender(ctx, pool, user.ID, gender); err != nil {
				log.Printf("ERROR updating user %s (%s): %v", user.ID, user.Name, err)
				continue
			}

			switch gender {
			case "MALE":
				totalMale++
			case "FEMALE":
				totalFemale++
			default:
				totalUnknown++
			}
		}

		if end < len(users) {
			log.Println("Sleeping 5s for rate limit...")
			time.Sleep(5 * time.Second)
		}
	}

	log.Printf("Done! Male: %d, Female: %d, Unknown: %d, Total: %d",
		totalMale, totalFemale, totalUnknown, totalMale+totalFemale+totalUnknown)
}

func fetchUsersWithoutGender(ctx context.Context, pool *pgxpool.Pool) ([]userRow, error) {
	rows, err := pool.Query(ctx,
		"SELECT id, name FROM giki_wallet.users WHERE gender IS NULL ORDER BY name")
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var users []userRow
	for rows.Next() {
		var u userRow
		if err := rows.Scan(&u.ID, &u.Name); err != nil {
			return nil, err
		}
		users = append(users, u)
	}
	return users, rows.Err()
}

func classifyNames(apiKey string, users []userRow) ([]nameGender, error) {
	names := make([]string, len(users))
	for i, u := range users {
		names[i] = u.Name
	}

	prompt := fmt.Sprintf(`Classify each of these Pakistani names as MALE, FEMALE, or UNKNOWN.
Return ONLY a JSON array, no markdown, no explanation.

Format: [{"name":"...","gender":"MALE|FEMALE|UNKNOWN"},...]

Names:
%s`, strings.Join(names, "\n"))

	reqBody := geminiRequest{
		Contents: []geminiContent{
			{Parts: []geminiPart{{Text: prompt}}},
		},
	}

	body, err := json.Marshal(reqBody)
	if err != nil {
		return nil, fmt.Errorf("marshal request: %w", err)
	}

	url := fmt.Sprintf(
		"https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=%s",
		apiKey)

	resp, err := http.Post(url, "application/json", bytes.NewReader(body))
	if err != nil {
		return nil, fmt.Errorf("API call failed: %w", err)
	}
	defer resp.Body.Close()

	respBody, err := io.ReadAll(resp.Body)
	if err != nil {
		return nil, fmt.Errorf("read response: %w", err)
	}

	if resp.StatusCode != http.StatusOK {
		return nil, fmt.Errorf("API returned %d: %s", resp.StatusCode, string(respBody))
	}

	var geminiResp geminiResponse
	if err := json.Unmarshal(respBody, &geminiResp); err != nil {
		return nil, fmt.Errorf("unmarshal response: %w", err)
	}

	if len(geminiResp.Candidates) == 0 || len(geminiResp.Candidates[0].Content.Parts) == 0 {
		return nil, fmt.Errorf("empty response from Gemini")
	}

	text := geminiResp.Candidates[0].Content.Parts[0].Text
	text = strings.TrimSpace(text)
	text = strings.TrimPrefix(text, "```json")
	text = strings.TrimPrefix(text, "```")
	text = strings.TrimSuffix(text, "```")
	text = strings.TrimSpace(text)

	var results []nameGender
	if err := json.Unmarshal([]byte(text), &results); err != nil {
		return nil, fmt.Errorf("parse Gemini JSON (%s): %w", text[:min(100, len(text))], err)
	}

	return results, nil
}

func lookupGender(results []nameGender, name string) string {
	nameLower := strings.ToLower(strings.TrimSpace(name))
	for _, r := range results {
		if strings.ToLower(strings.TrimSpace(r.Name)) == nameLower {
			g := strings.ToUpper(r.Gender)
			if g == "MALE" || g == "FEMALE" {
				return g
			}
			return "UNKNOWN"
		}
	}
	return "UNKNOWN"
}

func updateUserGender(ctx context.Context, pool *pgxpool.Pool, userID uuid.UUID, gender string) error {
	_, err := pool.Exec(ctx,
		"UPDATE giki_wallet.users SET gender = $1, updated_at = NOW() WHERE id = $2",
		gender, userID)
	return err
}
