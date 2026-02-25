package worker

type UserData struct {
	Email string `json:"email"`
	Name  string `json:"name"`
	Link  string `json:"link"`
}

type StudentVerifyPayload struct {
	Email string `json:"email"`
	Name  string `json:"name"`
	Link  string `json:"link"`
}

type EmployeeWaitPayload struct {
	Email string `json:"email"`
	Name  string `json:"name"`
}

type EmployeeApprovedPayload struct {
	Email string `json:"email"`
	Name  string `json:"name"`
	Link  string `json:"link"`
}

type AccountCreatedPayload struct {
	Email    string `json:"email"`
	Name     string `json:"name"`
	Password string `json:"password"`
}

type PasswordResetPayload struct {
	Email string `json:"email"`
	Name  string `json:"name"`
	Link  string `json:"link"`
}

type TicketDetail struct {
	SerialNo      string `json:"serial_no"`
	TicketCode    string `json:"ticket_code"`
	PassengerName string `json:"passenger_name"`
	RouteName     string `json:"route_name"`
	TripTime      string `json:"trip_time"`
	Price         int    `json:"price"`
}

type TicketConfirmedPayload struct {
	Email      string         `json:"email"`
	UserName   string         `json:"user_name"`
	TotalPrice int            `json:"total_price"`
	Tickets    []TicketDetail `json:"tickets"`
}

type TicketCancelledPayload struct {
	Email        string `json:"email"`
	UserName     string `json:"user_name"`
	TicketCode   string `json:"ticket_code"`
	RouteName    string `json:"route_name"`
	RefundAmount int    `json:"refund_amount"`
	Reason       string `json:"reason"`
}

type ReconcilePaymentPayload struct {
	TxnRefNo string `json:"txn_ref_no"`
	Attempt  int    `json:"attempt"`
}

