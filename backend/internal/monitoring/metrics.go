package monitoring

import (
	"fmt"
	"net/http"
	"sort"
	"strconv"
	"strings"
	"sync"
	"time"

	"github.com/go-chi/chi/v5"
	"github.com/jackc/pgx/v5/pgxpool"
)

// Metrics exposes low-cardinality HTTP and pgxpool metrics in Prometheus text format.
type Metrics struct {
	pool     *pgxpool.Pool
	mu       sync.Mutex
	requests map[string]*requestStat
}

type requestStat struct {
	count    uint64
	duration float64
	buckets  []uint64
}

var bounds = []float64{.005, .01, .025, .05, .1, .25, .5, 1, 2.5, 5, 10}

func New(pool *pgxpool.Pool) *Metrics {
	return &Metrics{pool: pool, requests: make(map[string]*requestStat)}
}

func (m *Metrics) Middleware(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if r.URL.Path == "/metrics" {
			next.ServeHTTP(w, r)
			return
		}
		wrapped := &statusWriter{ResponseWriter: w, status: http.StatusOK}
		start := time.Now()
		next.ServeHTTP(wrapped, r)
		route := chi.RouteContext(r.Context()).RoutePattern()
		if route == "" {
			route = "unmatched"
		}
		key := r.Method + "\x00" + route + "\x00" + strconv.Itoa(wrapped.status)
		m.mu.Lock()
		stat := m.requests[key]
		if stat == nil {
			stat = &requestStat{buckets: make([]uint64, len(bounds))}
			m.requests[key] = stat
		}
		elapsed := time.Since(start).Seconds()
		stat.count++
		stat.duration += elapsed
		for i, bound := range bounds {
			if elapsed <= bound {
				stat.buckets[i]++
			}
		}
		m.mu.Unlock()
	})
}

type statusWriter struct {
	http.ResponseWriter
	status int
	wrote  bool
}

func (w *statusWriter) WriteHeader(code int) {
	if !w.wrote {
		w.status, w.wrote = code, true
		w.ResponseWriter.WriteHeader(code)
	}
}
func (w *statusWriter) Write(b []byte) (int, error) {
	if !w.wrote {
		w.WriteHeader(http.StatusOK)
	}
	return w.ResponseWriter.Write(b)
}
func (w *statusWriter) Unwrap() http.ResponseWriter { return w.ResponseWriter }
func (w *statusWriter) Flush() {
	if !w.wrote {
		w.WriteHeader(http.StatusOK)
	}
	if flusher, ok := w.ResponseWriter.(http.Flusher); ok {
		flusher.Flush()
	}
}

func (m *Metrics) ServeHTTP(w http.ResponseWriter, _ *http.Request) {
	w.Header().Set("Content-Type", "text/plain; version=0.0.4; charset=utf-8")
	m.mu.Lock()
	defer m.mu.Unlock()
	keys := make([]string, 0, len(m.requests))
	for key := range m.requests {
		keys = append(keys, key)
	}
	sort.Strings(keys)
	fmt.Fprintln(w, "# HELP giki_backend_http_requests_total HTTP requests handled.")
	fmt.Fprintln(w, "# TYPE giki_backend_http_requests_total counter")
	for _, key := range keys {
		parts := strings.Split(key, "\x00")
		fmt.Fprintf(w, "giki_backend_http_requests_total{method=%q,route=%q,status=%q} %d\n", parts[0], parts[1], parts[2], m.requests[key].count)
	}
	fmt.Fprintln(w, "# HELP giki_backend_http_request_duration_seconds HTTP request duration in seconds.")
	fmt.Fprintln(w, "# TYPE giki_backend_http_request_duration_seconds histogram")
	for _, key := range keys {
		parts, stat := strings.Split(key, "\x00"), m.requests[key]
		labels := fmt.Sprintf("method=%q,route=%q,status=%q", parts[0], parts[1], parts[2])
		for i, bound := range bounds {
			fmt.Fprintf(w, "giki_backend_http_request_duration_seconds_bucket{%s,le=%q} %d\n", labels, strconv.FormatFloat(bound, 'g', -1, 64), stat.buckets[i])
		}
		fmt.Fprintf(w, "giki_backend_http_request_duration_seconds_bucket{%s,le=\"+Inf\"} %d\n", labels, stat.count)
		fmt.Fprintf(w, "giki_backend_http_request_duration_seconds_sum{%s} %s\n", labels, strconv.FormatFloat(stat.duration, 'g', -1, 64))
		fmt.Fprintf(w, "giki_backend_http_request_duration_seconds_count{%s} %d\n", labels, stat.count)
	}
	fmt.Fprintln(w, "# HELP giki_backend_db_pool_connections Database pool connections by state.")
	fmt.Fprintln(w, "# TYPE giki_backend_db_pool_connections gauge")
	fmt.Fprintln(w, "# HELP giki_backend_db_pool_max_connections Configured maximum database pool connections.")
	fmt.Fprintln(w, "# TYPE giki_backend_db_pool_max_connections gauge")
	fmt.Fprintln(w, "# HELP giki_backend_db_pool_acquire_total Total database pool acquisitions.")
	fmt.Fprintln(w, "# TYPE giki_backend_db_pool_acquire_total counter")
	fmt.Fprintln(w, "# HELP giki_backend_db_pool_empty_acquire_total Acquisitions that found the pool empty and waited.")
	fmt.Fprintln(w, "# TYPE giki_backend_db_pool_empty_acquire_total counter")
	fmt.Fprintln(w, "# HELP giki_backend_db_pool_canceled_acquire_total Canceled database pool acquisitions.")
	fmt.Fprintln(w, "# TYPE giki_backend_db_pool_canceled_acquire_total counter")
	fmt.Fprintln(w, "# HELP giki_backend_db_pool_acquire_duration_seconds_total Total time spent acquiring connections.")
	fmt.Fprintln(w, "# TYPE giki_backend_db_pool_acquire_duration_seconds_total counter")
	stat := m.pool.Stat()
	fmt.Fprintf(w, "giki_backend_db_pool_connections{state=\"total\"} %d\n", stat.TotalConns())
	fmt.Fprintf(w, "giki_backend_db_pool_connections{state=\"acquired\"} %d\n", stat.AcquiredConns())
	fmt.Fprintf(w, "giki_backend_db_pool_connections{state=\"idle\"} %d\n", stat.IdleConns())
	fmt.Fprintf(w, "giki_backend_db_pool_connections{state=\"constructing\"} %d\n", stat.ConstructingConns())
	fmt.Fprintf(w, "giki_backend_db_pool_max_connections %d\n", stat.MaxConns())
	fmt.Fprintf(w, "giki_backend_db_pool_acquire_total %d\n", stat.AcquireCount())
	fmt.Fprintf(w, "giki_backend_db_pool_empty_acquire_total %d\n", stat.EmptyAcquireCount())
	fmt.Fprintf(w, "giki_backend_db_pool_canceled_acquire_total %d\n", stat.CanceledAcquireCount())
	fmt.Fprintf(w, "giki_backend_db_pool_acquire_duration_seconds_total %s\n", strconv.FormatFloat(stat.AcquireDuration().Seconds(), 'g', -1, 64))
}
