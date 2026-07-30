package gateway

import (
	"bytes"
	"context"
	"crypto/hmac"
	"crypto/sha256"
	"encoding/hex"
	"encoding/json"
	"fmt"
	"log"
	"net/http"
	"sort"
	"strings"
	"time"

	commonerrors "github.com/hash-walker/giki-wallet/internal/common/errors"
)

// =============================================================================
// CONSTANTS - Field name constants
// =============================================================================

const (
	FieldVersion           = "pp_Version"
	FieldTxnType           = "pp_TxnType"
	FieldLanguage          = "pp_Language"
	FieldMerchantID        = "pp_MerchantID"
	FieldPassword          = "pp_Password"
	FieldAmount            = "pp_Amount"
	FieldBankID            = "pp_BankID"
	FieldBillReference     = "pp_BillReference"
	FieldTxnRefNo          = "pp_TxnRefNo"
	FieldDescription       = "pp_Description"
	FieldMobileNumber      = "pp_MobileNumber"
	FieldCNIC              = "pp_CNIC"
	FieldTxnDateTime       = "pp_TxnDateTime"
	FieldTxnExpiryDateTime = "pp_TxnExpiryDateTime"
	FieldReturnURL         = "pp_ReturnURL"
	FieldSecureHash        = "pp_SecureHash"
	FieldTxnCurrency       = "pp_TxnCurrency"
	FieldProductID         = "pp_ProductID"
	FieldSubMerchantID     = "pp_SubMerchantID"
	FieldMPF1              = "ppmpf_1"
	FieldMPF2              = "ppmpf_2"
	FieldMPF3              = "ppmpf_3"
	FieldMPF4              = "ppmpf_4"
	FieldMPF5              = "ppmpf_5"
)

// =============================================================================
// TYPES
// =============================================================================

type JazzCashFields map[string]string

type JazzCashClient struct {
	merchantID       string
	password         string
	integritySalt    string
	merchantMPIN     string
	cardCallbackURL  string
	baseURL          string
	walletPaymentURL string
	cardPaymentURL   string
	statusInquiryURL string
	httpClient       *http.Client // For making API calls
}

// =============================================================================
// CONSTRUCTOR
// =============================================================================

func NewJazzCashClient(
	merchantID string,
	password string,
	integritySalt string,
	merchantMPIN string,
	cardCallbackURL string,
	baseURL string,
	walletPaymentURL string,
	cardPaymentURL string,
	statusInquiryURL string,
) *JazzCashClient {
	return &JazzCashClient{
		merchantID:       merchantID,
		password:         password,
		integritySalt:    integritySalt,
		merchantMPIN:     merchantMPIN,
		cardCallbackURL:  cardCallbackURL,
		baseURL:          baseURL,
		walletPaymentURL: walletPaymentURL,
		cardPaymentURL:   cardPaymentURL,
		statusInquiryURL: statusInquiryURL,
		httpClient: &http.Client{
			Timeout: 45 * time.Second, // HTTP timeout
		},
	}
}

// =============================================================================
// PUBLIC API METHODS - Gateway interface implementation
// =============================================================================

func (c *JazzCashClient) SubmitMWallet(ctx context.Context, req MWalletInitiateRequest) (*MWalletInitiateResponse, error) {
	fields := c.buildMWalletFields(req)

	// find the secure hash
	secureHash, err := c.JazzcashSecureHash(fields)

	if err != nil {
		return nil, commonerrors.Wrap(commonerrors.ErrInternal, fmt.Errorf("failed to compute secure hash: %w", err))
	}

	fields[FieldSecureHash] = secureHash

	// convert fields to json body
	jsonBody, err := json.Marshal(fields)
	if err != nil {
		return nil, commonerrors.Wrap(commonerrors.ErrInternal, fmt.Errorf("failed to marshal payload: %w", err))
	}

	// create a https post request
	fullURL := strings.TrimSuffix(c.baseURL, "/") + "/" + strings.TrimPrefix(c.walletPaymentURL, "/")
	httpReq, err := http.NewRequestWithContext(ctx, "POST", fullURL, bytes.NewBuffer(jsonBody))

	if err != nil {
		return nil, commonerrors.Wrap(commonerrors.ErrInternal, fmt.Errorf("failed to create http request: %w", err))
	}

	// set headers content-type
	httpReq.Header.Set("Content-Type", "application/json")

	// make http request
	resp, err := c.httpClient.Do(httpReq)

	if err != nil {
		return nil, commonerrors.Wrap(commonerrors.ErrExternalService, err)
	}
	defer resp.Body.Close()

	// check http status
	if resp.StatusCode != http.StatusOK {
		return nil, commonerrors.Wrap(commonerrors.ErrExternalService, fmt.Errorf("inquiry API returned status %d", resp.StatusCode))
	}

	// parse json resp

	var responseMap map[string]any

	if err := json.NewDecoder(resp.Body).Decode(&responseMap); err != nil {
		return nil, commonerrors.Wrap(commonerrors.ErrInternal, fmt.Errorf("failed to decode response: %w", err))
	}

	// verify response hash

	if err := c.verifyResponseHash(responseMap); err != nil {
		log.Printf("[jazzcash] MWallet response hash verification failed: %v", err)
	}

	return c.mapMWalletResponse(responseMap), nil
}

func (c *JazzCashClient) InitiateCard(ctx context.Context, req CardInitiateRequest) (*CardInitiateResponse, error) {
	fields := c.buildCardFields(req)

	// find the secure hash
	secureHash, err := c.JazzcashSecureHash(fields)

	if err != nil {
		return nil, commonerrors.Wrap(commonerrors.ErrInternal, fmt.Errorf("failed to compute secure hash: %w", err))
	}

	fields[FieldSecureHash] = secureHash

	return &CardInitiateResponse{
		PostURL: strings.TrimSuffix(c.baseURL, "/") + "/" + strings.TrimPrefix(c.cardPaymentURL, "/"),
		Fields:  fields,
	}, nil
}

func (c *JazzCashClient) ParseAndVerifyCardCallback(ctx context.Context, rForm map[string]string) (*CardCallback, error) {
	responseMap := make(map[string]any)

	for key, val := range rForm {
		responseMap[key] = val
	}

	// verify response hash

	if err := c.verifyResponseHash(responseMap); err != nil {
		log.Printf("[jazzcash] card callback response hash verification failed: %v", err)
	}

	return c.mapCardResponse(responseMap), nil

}

func (c *JazzCashClient) Inquiry(ctx context.Context, req InquiryRequest) (*InquiryResponse, error) {
	fields := c.buildInquiryFields(req.TxnRefNo)

	secureHash, err := c.JazzcashSecureHash(fields)

	if err != nil {
		return nil, commonerrors.Wrap(commonerrors.ErrInternal, fmt.Errorf("failed to compute secure hash: %w", err))
	}

	fields[FieldSecureHash] = secureHash

	// convert fields to json body
	jsonBody, err := json.Marshal(fields)
	if err != nil {
		return nil, commonerrors.Wrap(commonerrors.ErrInternal, fmt.Errorf("failed to marshal inquiry fields: %w", err))
	}

	// create a https post request
	fullURL := strings.TrimSuffix(c.baseURL, "/") + "/" + strings.TrimPrefix(c.statusInquiryURL, "/")
	httpReq, err := http.NewRequestWithContext(ctx, "POST", fullURL, bytes.NewBuffer(jsonBody))

	if err != nil {
		return nil, commonerrors.Wrap(commonerrors.ErrInternal, fmt.Errorf("failed to create inquiry http request: %w", err))
	}

	// set headers content-type
	httpReq.Header.Set("Content-Type", "application/json")

	// make http request
	resp, err := c.httpClient.Do(httpReq)

	if err != nil {
		return nil, commonerrors.Wrap(commonerrors.ErrExternalService, err)
	}
	defer resp.Body.Close()

	// check http status
	if resp.StatusCode != http.StatusOK {
		return nil, commonerrors.Wrap(commonerrors.ErrExternalService, fmt.Errorf("inquiry API returned status %d", resp.StatusCode))
	}

	// parse json resp

	var responseMap map[string]any

	if err := json.NewDecoder(resp.Body).Decode(&responseMap); err != nil {
		return nil, commonerrors.Wrap(commonerrors.ErrInternal, fmt.Errorf("failed to decode response: %w", err))
	}

	// verify response hash

	if err := c.verifyResponseHash(responseMap); err != nil {
		log.Printf("[jazzcash] inquiry response hash verification failed: %v", err)
	}

	// 11. Map response to InquiryResponse struct
	res := c.mapInquiryResponse(responseMap)
	return &res, nil

}

// =============================================================================
// HELPERS - Secure hash computation and Verification
// =============================================================================

func (c *JazzCashClient) JazzcashSecureHash(requestData JazzCashFields) (string, error) {

	ppFields := make(map[string]string)

	// extract the pp_ or the ppmpf_ fields

	for k, v := range requestData {
		b := (strings.HasPrefix(k, "pp_") || strings.HasPrefix(k, "ppmpf_")) && k != FieldSecureHash

		if b && v != "" {
			ppFields[k] = v
		}
	}

	keys := make([]string, 0, len(ppFields))

	// get the keys from the ppFields and then sort the keys
	for k := range ppFields {
		keys = append(keys, k)
	}

	sort.Strings(keys)

	// build the string of keys with & in between

	var message strings.Builder

	for i, k := range keys {
		if i > 0 {
			message.WriteString("&")
		}
		message.WriteString(ppFields[k])
	}

	// prepend the integrity salt with & to the message

	saltedMessage := c.integritySalt + "&" + message.String()

	// make the HMAC hash from the salted message with secret integrity salt

	mac := hmac.New(sha256.New, []byte(c.integritySalt))
	mac.Write([]byte(saltedMessage))
	hash := mac.Sum(nil)

	return strings.ToUpper(hex.EncodeToString(hash)), nil
}

// verifyResponseHash verifies the secure hash in JazzCash response
func (c *JazzCashClient) verifyResponseHash(responseMap map[string]any) error {
	// Extract received hash
	receivedHash, ok := responseMap["pp_SecureHash"].(string)
	if !ok || receivedHash == "" {
		return nil
	}

	// Build fields map for verification (exclude pp_SecureHash)
	fields := make(JazzCashFields)
	for k, v := range responseMap {
		if k != FieldSecureHash {
			// Convert value to string
			fields[k] = fmt.Sprintf("%v", v)
		}
	}

	// Compute expected hash
	expectedHash, err := c.JazzcashSecureHash(fields)
	if err != nil {
		return commonerrors.Wrap(commonerrors.ErrInternal, fmt.Errorf("failed to compute expected hash: %w", err))
	}

	// Verify
	if receivedHash != expectedHash {
		return commonerrors.Wrap(commonerrors.ErrInternal, fmt.Errorf("hash mismatch: received %s, expected %s", receivedHash, expectedHash))
	}

	return nil
}

// =============================================================================
// HELPERS - Field builders
// =============================================================================

// Build MWallet payload fields
func (c *JazzCashClient) buildMWalletFields(req MWalletInitiateRequest) JazzCashFields {
	fields := make(JazzCashFields)

	fields[FieldAmount] = req.AmountPaisa
	fields[FieldBankID] = ""
	fields[FieldBillReference] = req.BillRefID
	fields[FieldCNIC] = req.CNICLast6
	fields[FieldDescription] = req.Description
	fields[FieldLanguage] = "EN"
	fields[FieldMerchantID] = c.merchantID
	fields[FieldMobileNumber] = req.MobileNumber
	fields[FieldPassword] = c.password
	fields[FieldProductID] = ""
	fields[FieldSubMerchantID] = ""
	fields[FieldTxnCurrency] = "PKR"
	fields[FieldTxnDateTime] = req.TxnDateTime
	fields[FieldTxnExpiryDateTime] = req.TxnExpiryDateTime
	fields[FieldTxnRefNo] = req.TxnRefNo
	fields[FieldMPF1] = ""
	fields[FieldMPF2] = ""
	fields[FieldMPF3] = ""
	fields[FieldMPF4] = ""
	fields[FieldMPF5] = ""

	return fields
}

// Build Card payload fields
func (c *JazzCashClient) buildCardFields(req CardInitiateRequest) JazzCashFields {
	fields := make(JazzCashFields)

	fields[FieldVersion] = "1.1"
	fields[FieldTxnType] = "MPAY"
	fields[FieldLanguage] = "EN"
	fields[FieldMerchantID] = c.merchantID
	fields[FieldPassword] = c.password
	fields[FieldTxnRefNo] = req.TxnRefNo
	fields[FieldAmount] = req.AmountPaisa
	fields[FieldTxnCurrency] = "PKR"
	fields[FieldTxnDateTime] = req.TxnDateTime
	fields[FieldBillReference] = req.BillRefID
	fields[FieldDescription] = req.Description
	fields[FieldTxnExpiryDateTime] = req.TxnExpiryDateTime
	fields[FieldReturnURL] = req.ReturnURL
	fields[FieldSubMerchantID] = ""
	fields[FieldBankID] = ""
	fields[FieldProductID] = ""
	fields[FieldMPF1] = ""
	fields[FieldMPF2] = ""
	fields[FieldMPF3] = ""
	fields[FieldMPF4] = ""
	fields[FieldMPF5] = ""

	return fields
}

func (c *JazzCashClient) buildInquiryFields(txnRefNo string) JazzCashFields {
	fields := make(JazzCashFields)

	fields[FieldTxnRefNo] = txnRefNo
	fields[FieldMerchantID] = c.merchantID
	fields[FieldPassword] = c.password

	return fields
}

// =============================================================================
// HELPERS - Response mappers
// =============================================================================

// mapResponseCodeToStatus maps JazzCash response code to Status enum

func mapResponseCodeToStatus(responseCode string) Status {
	// Key success codes
	switch responseCode {
	case "000", "200", "121":
		return StatusSuccess
	}

	// Common failure codes (map the ones that are explicitly "Failed" in docs)
	switch responseCode {
	case "001", "002", "003", "004", "024",
		"101", "102", "105", "110", "111", "112", "115", "116", "118",
		"127", "134", "199", "410", "412", "999":
		return StatusFailed
	}

	// Pending codes
	switch responseCode {
	case "157", "124", "210":
		return StatusPending
	}

	// 4xx range - typically failed transactions
	if len(responseCode) == 3 && responseCode[0] == '4' {
		return StatusFailed
	}

	// Default: unknown (log for debugging)
	if responseCode != "" {
		log.Printf("[jazzcash] unmapped response code %q", responseCode)
	}
	return StatusUnknown
}

func (c *JazzCashClient) mapInquiryResponse(responseMap map[string]any) InquiryResponse {
	resp := InquiryResponse{
		Raw: responseMap,
	}

	apiCode, _ := responseMap["pp_ResponseCode"].(string)
	resp.ResponseCode = apiCode

	paymentCode, _ := responseMap["pp_PaymentResponseCode"].(string)
	resp.PaymentResponseCode = paymentCode

	statusCode := paymentCode
	if statusCode == "" {
		if status, ok := responseMap["pp_Status"].(string); ok && status != "" {
			// Map pp_Status to a code we can evaluate
			switch status {
			case "Completed":
				statusCode = "121" // Completed transaction
			case "Pending":
				statusCode = "157" // Pending
			case "Failed":
				statusCode = "999" // Failed
			}
		}

		if statusCode == "" {
			statusCode = ""
		}
	}

	// Map to status
	resp.Status = mapResponseCodeToStatus(statusCode)

	// Convert response code to user-friendly message
	resp.Message = getUserFriendlyMessage(statusCode)

	// Extract RRN
	if rrn, ok := responseMap["pp_RetreivalReferenceNo"].(string); ok {
		resp.RRN = rrn
	}

	return resp
}

func (c *JazzCashClient) mapMWalletResponse(responseMap map[string]any) *MWalletInitiateResponse {
	resp := &MWalletInitiateResponse{
		Raw: responseMap,
	}

	responseCode, _ := responseMap["pp_ResponseCode"].(string)
	resp.ResponseCode = responseCode

	// Map to status
	resp.Status = mapResponseCodeToStatus(responseCode)

	// Convert response code to user-friendly message
	resp.Message = getUserFriendlyMessage(responseCode)

	// Extract RRN
	if rrn, ok := responseMap["pp_RetreivalReferenceNo"].(string); ok {
		resp.RRN = rrn
	}

	return resp

}

func (c *JazzCashClient) mapCardResponse(responseMap map[string]any) *CardCallback {
	resp := &CardCallback{
		Raw: responseMap,
	}

	responseCode, _ := responseMap["pp_ResponseCode"].(string)
	resp.ResponseCode = responseCode

	// Map to status
	resp.Status = mapResponseCodeToStatus(responseCode)

	// Convert response code to user-friendly message
	resp.Message = getUserFriendlyMessage(responseCode)

	txnRefNo, _ := responseMap["pp_TxnRefNo"].(string)

	resp.TxnRefNo = txnRefNo

	// Extract RRN
	if rrn, ok := responseMap["pp_RetreivalReferenceNo"].(string); ok {
		resp.RRN = rrn
	}

	return resp

}

// =============================================================================
// HELPERS - Response Code
// =============================================================================

// getUserFriendlyMessage maps JazzCash response codes to user-friendly messages
func getUserFriendlyMessage(responseCode string) string {
	// Key codes that users need to know about
	switch responseCode {
	// Success codes
	case "000":
		return "Transaction completed successfully"
	case "121":
		return "Transaction confirmed successfully"
	case "200":
		return "Transaction approved"

	// MWallet specific errors
	case "024":
		return "Incorrect MPIN. Please try again with the correct MPIN"
	case "001":
		return "Transaction limit exceeded. Please contact your bank"
	case "002":
		return "Account not found. Please verify your account details"
	case "003":
		return "Account is inactive. Please contact JazzCash support"
	case "004":
		return "Insufficient balance. Please add funds to your account"

	// Card specific errors
	case "415":
		return "3D Secure verification failed. Please check your 3D Secure ID"
	case "416":
		return "CVV verification failed. Please check your CVV and try again"
	case "424":
		return "Incorrect CVV. Please enter the correct CVV and try again"
	case "102":
		return "Card is blocked. Please contact your bank"
	case "404":
		return "Card has expired. Please use a valid card"
	case "405":
		return "Insufficient balance on card. Please check your card balance"
	case "407":
		return "Payment gateway encountered a temporary issue. Please try again in a few minutes"
	case "419":
		return "Card is not enrolled in 3D Secure. Please contact your bank to activate 3D Secure"

	// Common errors
	case "101":
		return "Invalid merchant credentials"
	case "105":
		return "Transaction exceeds limit. Please contact support"
	case "110":
		return "Invalid transaction value"
	case "111":
		return "Transaction not allowed"
	case "112":
		return "Transaction was cancelled"
	case "115":
		return "Security verification failed. Please try again"
	case "116":
		return "Transaction has expired. Please initiate a new transaction"
	case "134":
		return "Transaction timed out. Please try again"
	case "999":
		return "Transaction failed due to a technical issue. Please try again later"

	// Pending codes
	case "157":
		return "Transaction is pending. Please wait for confirmation"
	case "124":
		return "Order is pending. Waiting for payment confirmation"
	case "210":
		return "Authorization pending. Please wait"

	// User cancellations
	case "410", "412":
		return "Transaction was cancelled by you"

	// Maintenance
	case "127", "118":
		return "Service is temporarily under maintenance. Please try again later"

	// Default: Return raw code for debugging (or a generic message)
	default:
		if responseCode != "" {
			return fmt.Sprintf("Transaction failed with code: %s. Please contact support", responseCode)
		}
		return "Transaction failed. Please try again"
	}
}
