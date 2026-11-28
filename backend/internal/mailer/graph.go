package mailer

import (
	"bytes"
	"embed"
	"encoding/json"
	"fmt"
	"html/template"
	"log"
	"net/http"
	"net/url"
	"strings"
	"sync"
	"time"
)

//go:embed templates/*.html
var templateFS embed.FS

// tokenExpiryMargin is how long before expires_in a cached token stops being used.
const tokenExpiryMargin = 60 * time.Second

type GraphSender struct {
	ClientID     string
	TenantID     string
	ClientSecret string
	SenderEmail  string
	httpClient   *http.Client

	mu          sync.Mutex
	cachedToken string
	tokenExpiry time.Time
}

func NewGraphSender(clientID, tenantID, clientSecret, senderEmail string) *GraphSender {
	return &GraphSender{
		ClientID:     clientID,
		TenantID:     tenantID,
		ClientSecret: clientSecret,
		SenderEmail:  senderEmail,
		httpClient:   &http.Client{Timeout: 30 * time.Second},
	}
}

func (g *GraphSender) SendTemplate(to, subject, templateName string, data interface{}) error {
	log.Printf("[MAILER] Parsing templates for %s", templateName)

	tmpl := template.New("mail")
	_, err := tmpl.ParseFS(templateFS, "templates/base.html", "templates/"+templateName)
	if err != nil {
		return fmt.Errorf("failed to parse templates: %w", err)
	}

	// Debug: list all templates in the set
	var names []string
	for _, t := range tmpl.Templates() {
		names = append(names, t.Name())
	}
	log.Printf("[MAILER] Templates in set: %s", strings.Join(names, ", "))

	var body bytes.Buffer

	// Render HTML - execute the "base" template which includes our specific template
	if err := tmpl.ExecuteTemplate(&body, "base", data); err != nil {
		return fmt.Errorf("failed to render template %s: %w", templateName, err)
	}

	// Call the low-level Send method
	return g.Send(to, subject, body.String())
}

func (g *GraphSender) Send(to, subject, htmlBody string) error {
	// get Access Token
	token, err := g.getAccessToken()

	if err != nil {
		return fmt.Errorf("failed to get graph token: %w", err)
	}

	// prepare Payload
	payload := graphEmailPayload{
		SaveToSentItems: false,

		Message: graphMessage{
			Subject: subject,
			Body: graphBody{
				ContentType: "HTML",
				Content:     htmlBody,
			},

			ToRecipients: []graphRecipient{
				{
					EmailAddress: graphEmailAddress{Address: to},
				},
			},
		},
	}

	jsonBytes, err := json.Marshal(payload)
	if err != nil {
		return fmt.Errorf("failed to marshal payload: %w", err)
	}

	// 3end Request

	url := fmt.Sprintf("https://graph.microsoft.com/v1.0/users/%s/sendMail", g.SenderEmail)

	req, err := http.NewRequest("POST", url, bytes.NewBuffer(jsonBytes))
	if err != nil {
		return err
	}

	req.Header.Set("Authorization", "Bearer "+token)
	req.Header.Set("Content-Type", "application/json")

	resp, err := g.httpClient.Do(req)

	if err != nil {
		return fmt.Errorf("graph api call failed: %w", err)
	}

	defer resp.Body.Close()

	if resp.StatusCode != http.StatusAccepted {
		return fmt.Errorf("graph api returned status: %d", resp.StatusCode)
	}

	return nil
}

// getAccessToken returns a cached token while one is still valid, and otherwise
// fetches a fresh one.
func (g *GraphSender) getAccessToken() (string, error) {
	g.mu.Lock()
	defer g.mu.Unlock()

	if g.cachedToken != "" && time.Now().Before(g.tokenExpiry) {
		return g.cachedToken, nil
	}

	tokenURL := fmt.Sprintf("https://login.microsoftonline.com/%s/oauth2/v2.0/token", g.TenantID)

	// Prepare Form Data (Encode URL-escapes every value, so secrets containing
	// '+', '&' or '%' reach Azure unchanged)
	data := url.Values{
		"grant_type":    {"client_credentials"},
		"client_id":     {g.ClientID},
		"client_secret": {g.ClientSecret},
		"scope":         {"https://graph.microsoft.com/.default"},
	}.Encode()

	req, err := http.NewRequest("POST", tokenURL, strings.NewReader(data))
	if err != nil {
		return "", err
	}

	req.Header.Set("Content-Type", "application/x-www-form-urlencoded")

	resp, err := g.httpClient.Do(req)
	if err != nil {
		return "", err
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		return "", fmt.Errorf("token fetch failed with status: %d", resp.StatusCode)
	}

	// Decode response
	var result struct {
		AccessToken string `json:"access_token"`
		ExpiresIn   int    `json:"expires_in"`
	}
	if err := json.NewDecoder(resp.Body).Decode(&result); err != nil {
		return "", err
	}

	g.cachedToken = result.AccessToken
	g.tokenExpiry = time.Now().Add(time.Duration(result.ExpiresIn)*time.Second - tokenExpiryMargin)

	return result.AccessToken, nil
}
