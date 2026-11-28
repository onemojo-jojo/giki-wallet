package mailer

import (
	"bytes"
	"fmt"
	"io"
	"net/http"
	"net/url"
	"strings"
	"testing"

	"github.com/stretchr/testify/require"
)

// tokenTransport intercepts the OAuth token request so no network is needed.
type tokenTransport struct {
	requests  int
	expiresIn int

	lastForm url.Values
}

func (f *tokenTransport) RoundTrip(req *http.Request) (*http.Response, error) {
	f.requests++

	body, err := io.ReadAll(req.Body)
	if err != nil {
		return nil, err
	}
	req.Body = io.NopCloser(bytes.NewReader(body))

	form, err := url.ParseQuery(string(body))
	if err != nil {
		return nil, err
	}
	f.lastForm = form

	payload := fmt.Sprintf(`{"access_token":"tok-%d","expires_in":%d}`, f.requests, f.expiresIn)
	return &http.Response{
		StatusCode: http.StatusOK,
		Header:     make(http.Header),
		Body:       io.NopCloser(strings.NewReader(payload)),
		Request:    req,
	}, nil
}

func newTestSender(expiresIn int) (*GraphSender, *tokenTransport) {
	transport := &tokenTransport{expiresIn: expiresIn}
	sender := NewGraphSender("client+id", "tenant", "sec+ret&x=1", "noreply@example.com")
	sender.httpClient = &http.Client{Transport: transport}
	return sender, transport
}

func TestGetAccessTokenURLEncodesForm(t *testing.T) {
	sender, transport := newTestSender(3600)

	token, err := sender.getAccessToken()
	require.NoError(t, err)
	require.Equal(t, "tok-1", token)

	// The secret contains '+', '&' and '=': without URL-encoding the form body
	// splits it into stray keys and the server reads a different secret.
	require.Equal(t, "sec+ret&x=1", transport.lastForm.Get("client_secret"))
	require.Equal(t, "client+id", transport.lastForm.Get("client_id"))
	require.Equal(t, "client_credentials", transport.lastForm.Get("grant_type"))
	require.Equal(t, "https://graph.microsoft.com/.default", transport.lastForm.Get("scope"))
}

func TestGetAccessTokenCachesToken(t *testing.T) {
	sender, transport := newTestSender(3600)

	first, err := sender.getAccessToken()
	require.NoError(t, err)
	second, err := sender.getAccessToken()
	require.NoError(t, err)

	require.Equal(t, "tok-1", first)
	require.Equal(t, "tok-1", second, "second call should reuse the cached token")
	require.Equal(t, 1, transport.requests, "token endpoint should be hit once")
}

func TestGetAccessTokenRefetchesShortLivedToken(t *testing.T) {
	sender, transport := newTestSender(1)

	_, err := sender.getAccessToken()
	require.NoError(t, err)
	_, err = sender.getAccessToken()
	require.NoError(t, err)

	require.Equal(t, 2, transport.requests, "a token that expires within the cache margin must be refetched")
}
