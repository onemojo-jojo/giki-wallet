package payment

import (
	"crypto/rand"
	"errors"
	"fmt"
	"math/big"
	"regexp"
	"strconv"
	"strings"
	"time"

	"github.com/jackc/pgx/v5/pgconn"
)

// =============================================================================
// HELPERS - Timezone (JazzCash expects PKT timestamps)
// =============================================================================

var pktLocation *time.Location

func init() {
	var err error
	pktLocation, err = time.LoadLocation("Asia/Karachi")
	if err != nil {
		pktLocation = time.FixedZone("PKT", 5*60*60)
	}
}

func NowPKT() time.Time {
	return time.Now().In(pktLocation)
}

// =============================================================================
// HELPERS - Reference Number Generation
// =============================================================================

func GenerateTxnRefNo() (string, error) {
	timestamp := NowPKT().Format("20060102150405")
	randBits, err := RandomBase32(4)
	if err != nil {
		return "", err
	}
	return fmt.Sprintf("T%s%s", timestamp, randBits), nil
}

func GenerateBillRefNo() (string, error) {
	timestamp := NowPKT().Format("20060102150405")
	randBits, err := RandomBase32(4)
	if err != nil {
		return "", err
	}
	return fmt.Sprintf("B%s%s", timestamp, randBits), nil
}

func RandomBase32(n int) (string, error) {
	const alphabet = "ABCDEFGHJKMNPQRSTUVWXYZ23456789"
	b := make([]byte, n)
	for i := range b {
		num, err := rand.Int(rand.Reader, big.NewInt(int64(len(alphabet))))
		if err != nil {
			return "", err
		}
		b[i] = alphabet[num.Int64()]
	}
	return string(b), nil
}

// =============================================================================
// HELPERS - Input Normalization
// =============================================================================

func NormalizePhoneNumber(phone string) (string, error) {
	re := regexp.MustCompile(`\D`)
	digits := re.ReplaceAllString(phone, "")

	if len(digits) == 0 {
		return "", fmt.Errorf("phone number contains no digits")
	}

	switch {
	case len(digits) == 11 && strings.HasPrefix(digits, "0"):
		return digits, nil
	case len(digits) == 12 && strings.HasPrefix(digits, "92"):
		return "0" + digits[2:], nil
	case len(digits) == 13 && strings.HasPrefix(digits, "92"):
		return "0" + digits[2:12], nil
	case len(digits) == 10:
		return "0" + digits, nil
	default:
		return "", fmt.Errorf("invalid phone number format: expected 10-13 digits, got %d", len(digits))
	}
}

func NormalizeCNICLast6(cnic string) (string, error) {
	re := regexp.MustCompile(`\D`)
	digits := re.ReplaceAllString(cnic, "")

	if len(digits) == 0 {
		return "", fmt.Errorf("CNIC contains no digits")
	}

	if len(digits) >= 6 {
		return digits[len(digits)-6:], nil
	}

	return "", fmt.Errorf("CNIC must have at least 6 digits, got %d", len(digits))
}

// =============================================================================
// HELPERS - Amount Conversion
// =============================================================================

// AmountToPaisa converts amount in smallest unit (paisa) to string
func AmountToPaisa(amountPaisa int64) string {
	return strconv.FormatInt(amountPaisa, 10)
}

// =============================================================================
// HELPERS - Checking Unique Constraint
// =============================================================================

func CheckUniqueConstraintViolation(err error) bool {
	var pgErr *pgconn.PgError
	if errors.As(err, &pgErr) && pgErr.Code == "23505" {
		return true
	}
	return false
}
