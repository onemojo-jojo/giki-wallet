package common

import (
	"errors"
	"net/http"
	"strconv"
	"time"
)

// ============================================================================
// SHARED REQUEST DTOs
// ============================================================================

type PaginationParams struct {
	Page     int `json:"page"`
	PageSize int `json:"page_size"`
}

func (p *PaginationParams) Bind(r *http.Request) error {
	p.Page = 1
	p.PageSize = 20

	pageStr := r.URL.Query().Get("page")
	if pageStr != "" {
		val, err := strconv.Atoi(pageStr)
		if err == nil && val > 0 {
			p.Page = val
		}
	}

	sizeStr := r.URL.Query().Get("page_size")
	if sizeStr != "" {
		val, err := strconv.Atoi(sizeStr)
		if err == nil && val > 0 {
			p.PageSize = val
		}
	}

	return nil
}

type DateRangeParams struct {
	StartDate time.Time `json:"start_date"`
	EndDate   time.Time `json:"end_date"`
}

func (d *DateRangeParams) Bind(r *http.Request) error {
	startStr := r.URL.Query().Get("start_date")
	endStr := r.URL.Query().Get("end_date")

	if startStr != "" {
		t, err := time.Parse(time.RFC3339, startStr)
		if err != nil {
			return errors.New("invalid start_date format, expected ISO8601")
		}
		d.StartDate = t
	} else {
		now := time.Now()
		offset := int(time.Monday - now.Weekday())
		if offset > 0 {
			offset = -6
		}
		d.StartDate = time.Date(now.Year(), now.Month(), now.Day(), 0, 0, 0, 0, now.Location()).AddDate(0, 0, offset)
	}

	if endStr != "" {
		t, err := time.Parse(time.RFC3339, endStr)
		if err != nil {
			return errors.New("invalid end_date format, expected ISO8601")
		}
		d.EndDate = t
	} else {
		d.EndDate = d.StartDate.AddDate(0, 0, 14)
	}

	return nil
}

type AdminFinanceListParams struct {
	PaginationParams
	DateRangeParams
}

func (p *AdminFinanceListParams) Bind(r *http.Request) error {
	if err := p.PaginationParams.Bind(r); err != nil {
		return err
	}
	if err := p.DateRangeParams.Bind(r); err != nil {
		return err
	}
	return nil
}

type TicketListParams struct {
	PaginationParams
	DateRangeParams
}

func (p *TicketListParams) Bind(r *http.Request) error {
	if err := p.PaginationParams.Bind(r); err != nil {
		return err
	}
	if err := p.DateRangeParams.Bind(r); err != nil {
		return err
	}
	return nil
}

type TransactionListParams struct {
	PaginationParams
	DateRangeParams
	Search string `json:"search"`
}

func (p *TransactionListParams) Bind(r *http.Request) error {
	if err := p.PaginationParams.Bind(r); err != nil {
		return err
	}
	if err := p.DateRangeParams.Bind(r); err != nil {
		return err
	}
	p.Search = r.URL.Query().Get("search")
	return nil
}

type GatewayTransactionListParams struct {
	PaginationParams
	DateRangeParams
	Search        string `json:"search"`
	Status        string `json:"status"`
	PaymentMethod string `json:"payment_method"`
}

func (p *GatewayTransactionListParams) Bind(r *http.Request) error {
	if err := p.PaginationParams.Bind(r); err != nil {
		return err
	}
	if err := p.DateRangeParams.Bind(r); err != nil {
		return err
	}
	p.Search = r.URL.Query().Get("search")
	p.Status = r.URL.Query().Get("status")
	p.PaymentMethod = r.URL.Query().Get("payment_method")
	return nil
}
