package model

type EmbarkApplication struct {
	EmbarkId     string    `json:"embarkId"`
	FirstName    *string   `json:"firstName"`
	LastName     *string   `json:"lastName"`
	Email        *string   `json:"url"`
	GPA          *float64  `json:"GPA"`
	GREMath      *float64  `json:"GREMath"`
	GREVerbal    *float64  `json:"GREVerbal"`
	Country      *string   `json:"country"`
	Areas        *[]string `json:"areas"`
	Materials    []URL     `json:"materials"`
	Recs         []URL     `json:"recs"`
	ExpectedRecs *int      `json:"expectedRecCount"`
}

func (self *EmbarkApplication) Id() string {
	return self.EmbarkId
}