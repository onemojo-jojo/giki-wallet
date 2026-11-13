package audit

import (
	"context"
	"encoding/json"
	"time"

	"github.com/google/uuid"
	"github.com/hash-walker/giki-wallet/internal/audit/audit_db"
	"github.com/jackc/pgx/v5/pgtype"
	"github.com/jackc/pgx/v5/pgxpool"
)

type Service struct {
	db      *pgxpool.Pool
	queries *audit_db.Queries
}

func NewService(db *pgxpool.Pool) *Service {
	return &Service{
		db:      db,
		queries: audit_db.New(db),
	}
}

// Security Actions
const (
	ActionLoginAttempt    = "LOGIN_ATTEMPT"
	ActionLoginSuccess    = "LOGIN_SUCCESS"
	ActionLoginFailure    = "LOGIN_FAILURE"
	ActionLogout          = "LOGOUT"
	ActionRegister        = "REGISTER"
	ActionPasswordChange  = "PASSWORD_CHANGE"
	ActionAdminCreateUser = "ADMIN_CREATE_USER"
	ActionAdminDeleteUser = "ADMIN_DELETE_USER"
	ActionAdminUpdateUser = "ADMIN_UPDATE_USER"

	ActionAdminCreateTrip          = "ADMIN_CREATE_TRIP"
	ActionAdminUpdateTrip          = "ADMIN_UPDATE_TRIP"
	ActionAdminDeleteTrip          = "ADMIN_DELETE_TRIP"
	ActionAdminCancelTrip          = "ADMIN_CANCEL_TRIP"
	ActionAdminUpdateQuotaOverride = "ADMIN_UPDATE_QUOTA_OVERRIDE"
)

// Security Statuses
const (
	StatusSuccess = "SUCCESS"
	StatusFailure = "FAILURE"
)

type Event struct {
	ActorID   *uuid.UUID
	Action    string
	TargetID  *uuid.UUID
	Details   map[string]interface{}
	IPAddress string
	UserAgent string
	Status    string
}

type SecurityEventRow struct {
	ID          uuid.UUID              `json:"id"`
	Action      string                 `json:"action"`
	IPAddress   string                 `json:"ip_address"`
	UserAgent   string                 `json:"user_agent"`
	Status      string                 `json:"status"`
	CreatedAt   time.Time              `json:"created_at"`
	Details     map[string]interface{} `json:"details"`
	ActorID     *uuid.UUID             `json:"actor_id"`
	ActorName   *string                `json:"actor_name"`
	ActorEmail  *string                `json:"actor_email"`
	TargetID    *uuid.UUID             `json:"target_id"`
	TargetName  *string                `json:"target_name"`
	TargetEmail *string                `json:"target_email"`
}

func (s *Service) LogSecurityEvent(ctx context.Context, event Event) error {
	detailsJSON, err := json.Marshal(event.Details)
	if err != nil {
		detailsJSON = []byte("{}")
	}

	// Convert uuid.UUID pointers to pgtype.UUID
	var actorID, targetID pgtype.UUID
	if event.ActorID != nil {
		bytes := [16]byte(*event.ActorID)
		actorID = pgtype.UUID{Bytes: bytes, Valid: true}
	}
	if event.TargetID != nil {
		bytes := [16]byte(*event.TargetID)
		targetID = pgtype.UUID{Bytes: bytes, Valid: true}
	}

	return s.queries.CreateSystemAuditLog(ctx, audit_db.CreateSystemAuditLogParams{
		ActorID:   actorID,
		Action:    event.Action,
		TargetID:  targetID,
		Details:   detailsJSON,
		IpAddress: event.IPAddress,
		UserAgent: pgtype.Text{String: event.UserAgent, Valid: event.UserAgent != ""},
		Status:    event.Status,
		CreatedAt: pgtype.Timestamp{Time: time.Now(), Valid: true},
	})
}

// ListSecurityEvents returns a paginated list of security logs with total count
func (s *Service) ListSecurityEvents(ctx context.Context, page, pageSize int) ([]SecurityEventRow, int64, error) {
	if page < 1 {
		page = 1
	}
	if pageSize < 1 {
		pageSize = 20
	}
	offset := (page - 1) * pageSize

	rows, err := s.queries.ListSystemAuditLogs(ctx, audit_db.ListSystemAuditLogsParams{
		Limit:  int32(pageSize),
		Offset: int32(offset),
	})
	if err != nil {
		return nil, 0, err
	}

	res := make([]SecurityEventRow, len(rows))
	for i, row := range rows {
		var details map[string]interface{}
		_ = json.Unmarshal(row.Details, &details)

		res[i] = SecurityEventRow{
			ID:          row.ID,
			Action:      row.Action,
			IPAddress:   row.IpAddress,
			UserAgent:   row.UserAgent.String,
			Status:      row.Status,
			CreatedAt:   row.CreatedAt.Time,
			Details:     details,
			ActorID:     toUUIDPtr(row.ActorID),
			ActorName:   toStringPtr(row.ActorName),
			ActorEmail:  toStringPtr(row.ActorEmail),
			TargetID:    toUUIDPtr(row.TargetID),
			TargetName:  toStringPtr(row.TargetName),
			TargetEmail: toStringPtr(row.TargetEmail),
		}
	}

	total, err := s.queries.CountSystemAuditLogs(ctx)
	if err != nil {
		return nil, 0, err
	}

	return res, total, nil
}

func toStringPtr(t pgtype.Text) *string {
	if !t.Valid {
		return nil
	}
	s := t.String
	return &s
}

func toUUIDPtr(u pgtype.UUID) *uuid.UUID {
	if !u.Valid {
		return nil
	}
	id := u.Bytes
	uuidID, _ := uuid.FromBytes(id[:])
	return &uuidID
}
