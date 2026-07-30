package gateway

import (
	"testing"

	"github.com/stretchr/testify/require"
)

func TestMapResponseCodeToStatus(t *testing.T) {
	tests := []struct {
		name string
		code string
		want Status
	}{
		{name: "success", code: "000", want: StatusSuccess},
		{name: "completed", code: "121", want: StatusSuccess},
		{name: "pending", code: "157", want: StatusPending},
		{name: "wrong mpin", code: "024", want: StatusFailed},
		{name: "insufficient balance", code: "004", want: StatusFailed},
		{name: "expired", code: "116", want: StatusFailed},
		{name: "timeout", code: "134", want: StatusFailed},
		{name: "cancelled", code: "410", want: StatusFailed},
		{name: "card error range", code: "415", want: StatusFailed},
		{name: "technical issue", code: "999", want: StatusFailed},
		{name: "unknown", code: "777", want: StatusUnknown},
		{name: "empty", code: "", want: StatusUnknown},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			require.Equal(t, tt.want, mapResponseCodeToStatus(tt.code))
		})
	}
}

func TestVerifyResponseHash(t *testing.T) {
	client := NewJazzCashClient("merchant", "password", "salt", "", "", "", "", "", "")

	fields := JazzCashFields{
		FieldMerchantID:   "merchant",
		FieldPassword:     "password",
		FieldTxnRefNo:     "T123",
		"pp_ResponseCode": "000",
	}

	hash, err := client.JazzcashSecureHash(fields)
	require.NoError(t, err)

	response := map[string]any{
		FieldMerchantID:   "merchant",
		FieldPassword:     "password",
		FieldTxnRefNo:     "T123",
		"pp_ResponseCode": "000",
		FieldSecureHash:   hash,
	}

	require.NoError(t, client.verifyResponseHash(response))

	response[FieldSecureHash] = "BADHASH"
	require.Error(t, client.verifyResponseHash(response))
}

func TestVerifyResponseHashAllowsMissingHashForCompatibility(t *testing.T) {
	client := NewJazzCashClient("merchant", "password", "salt", "", "", "", "", "", "")

	require.NoError(t, client.verifyResponseHash(map[string]any{
		FieldTxnRefNo:     "T123",
		"pp_ResponseCode": "000",
	}))
}
