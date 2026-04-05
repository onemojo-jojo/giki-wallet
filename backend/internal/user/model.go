package user

import (
	"time"

	"github.com/google/uuid"
	"github.com/hash-walker/giki-wallet/internal/common"
	userdb "github.com/hash-walker/giki-wallet/internal/user/user_db"
	"github.com/jackc/pgx/v5/pgtype"
)

type RegisterRequest struct {
	Name        string `json:"name"`
	Email       string `json:"email"`
	UserType    string `json:"user_type"`
	RegID       string `json:"reg_id,omitempty"`      // For students
	BatchYear   int32  `json:"batch_year,omitempty"`  // For students
	EmployeeID  string `json:"employee_id,omitempty"` // For employees
	Password    string `json:"password"`
	PhoneNumber string `json:"phone_number"`
	Gender      string `json:"gender,omitempty"`
}

type User struct {
	ID           uuid.UUID `json:"id"`
	Name         string    `json:"name"`
	Email        string    `json:"email"`
	UserType     string    `json:"user_type"`
	AccessToken  string    `json:"access_token,omitempty"`
	RefreshToken string    `json:"refresh_token,omitempty"`
	CreatedAt    time.Time `json:"created_at,omitempty"`
}

type CreateStudentParams struct {
	UserID        uuid.UUID
	RegID         string
	DegreeProgram pgtype.Text
	BatchYear     pgtype.Int4
}

type CreateEmployeeParams struct {
	UserID      uuid.UUID
	EmployeeID  string // Auto-generated UUID string
	Designation pgtype.Text
	Department  pgtype.Text
}

func mapDBUserToUser(u userdb.GikiWalletUser) *User {
	return &User{
		ID:        u.ID,
		Name:      u.Name,
		Email:     u.Email,
		UserType:  u.UserType,
		CreatedAt: u.CreatedAt,
	}
}

func mapCreateUserRowToUser(u userdb.CreateUserRow) *User {
	return &User{
		ID:        u.ID,
		Name:      u.Name,
		Email:     u.Email,
		UserType:  u.UserType,
		CreatedAt: u.CreatedAt,
	}
}

type Student struct {
	UserID        uuid.UUID   `json:"user_id"`
	RegID         string      `json:"reg_id"`
	DegreeProgram pgtype.Text `json:"degree_program"`
	BatchYear     pgtype.Int4 `json:"batch_year"`
}

// Mapper: DB -> Domain
func mapDBStudentToStudent(s userdb.GikiWalletStudentProfile) Student {
	return Student{
		UserID:        s.UserID,
		RegID:         s.RegID,
		DegreeProgram: s.DegreeProgram,
		BatchYear:     s.BatchYear,
	}
}

type Employee struct {
	UserID       uuid.UUID `json:"user_id"`
	EmployeeCode string    `json:"employee_code"`
	Designation  string    `json:"designation"`
	Department   string    `json:"department"`
}

func mapDBEmployeeToEmployee(e userdb.GikiWalletEmployeeProfile) Employee {
	return Employee{
		UserID:       e.UserID,
		EmployeeCode: e.EmployeeID,
		Designation:  common.TextToString(e.Designation),
		Department:   common.TextToString(e.Department),
	}
}

type AdminUser struct {
	ID          uuid.UUID `json:"id"`
	Name        string    `json:"name"`
	Email       string    `json:"email"`
	PhoneNumber string    `json:"phone_number"`
	IsActive    bool      `json:"is_active"`
	IsVerified  bool      `json:"is_verified"`
	UserType    string    `json:"user_type"`
	Gender      string    `json:"gender"`
	CreatedAt   time.Time `json:"created_at"`
	UpdatedAt   time.Time `json:"updated_at"`
}

func mapDBAdminUserToAdminUser(u userdb.ListUsersRow) AdminUser {
	return AdminUser{
		ID:          u.ID,
		Name:        u.Name,
		Email:       u.Email,
		PhoneNumber: u.PhoneNumber,
		IsActive:    u.IsActive,
		IsVerified:  u.IsVerified,
		UserType:    u.UserType,
		Gender:      common.TextToString(u.Gender),
		CreatedAt:   u.CreatedAt,
		UpdatedAt:   u.UpdatedAt,
	}
}

func mapDBUpdateUserStatusToAdminUser(u userdb.UpdateUserStatusRow) AdminUser {
	return AdminUser{
		ID:          u.ID,
		Name:        u.Name,
		Email:       u.Email,
		PhoneNumber: u.PhoneNumber,
		IsActive:    u.IsActive,
		IsVerified:  u.IsVerified,
		UserType:    u.UserType,
		Gender:      common.TextToString(u.Gender),
		CreatedAt:   u.CreatedAt,
		UpdatedAt:   u.UpdatedAt,
	}
}

type UsersListWithPagination struct {
	Data       []AdminUser `json:"data"`
	TotalCount int64       `json:"total_count"`
	Page       int         `json:"page"`
	PageSize   int         `json:"page_size"`
}

func mapDBUserRowToAdminUser(row userdb.GikiWalletUser) AdminUser {
	return AdminUser{
		ID:          row.ID,
		Name:        row.Name,
		Email:       row.Email,
		PhoneNumber: row.PhoneNumber,
		IsActive:    row.IsActive,
		IsVerified:  row.IsVerified,
		UserType:    row.UserType,
		Gender:      common.TextToString(row.Gender),
		CreatedAt:   row.CreatedAt,
		UpdatedAt:   row.UpdatedAt,
	}
}

func mapUpdateUserDetailsRowToAdminUser(row userdb.UpdateUserDetailsRow) AdminUser {
	return AdminUser{
		ID:          row.ID,
		Name:        row.Name,
		Email:       row.Email,
		PhoneNumber: row.PhoneNumber,
		IsActive:    row.IsActive,
		IsVerified:  row.IsVerified,
		UserType:    row.UserType,
		Gender:      common.TextToString(row.Gender),
		CreatedAt:   row.CreatedAt,
		UpdatedAt:   row.UpdatedAt,
	}
}

func mapGetUserByIDRowToAdminUser(row userdb.GetUserByIDRow) AdminUser {
	return AdminUser{
		ID:          row.ID,
		Name:        row.Name,
		Email:       row.Email,
		PhoneNumber: row.PhoneNumber,
		IsActive:    row.IsActive,
		IsVerified:  row.IsVerified,
		UserType:    row.UserType,
		Gender:      common.TextToString(row.Gender),
		CreatedAt:   row.CreatedAt,
		UpdatedAt:   row.UpdatedAt,
	}
}
