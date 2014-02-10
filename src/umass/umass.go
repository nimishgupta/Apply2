package umass

import (
	"log"
  "encoding/csv"
  "os"
  "model"
  "strconv"
  "regexp"
  "fmt"
)

type Application struct {
	PersonId     string   `json:"personId"`
	FirstName    string   `json:"firstName"`
	LastName     string   `json:"lastName"`
	Gender	     string   `json:"gender"`
  AdmitTerm    string   `json:"admitTerm"`
  Country      string	 `json:"country"`  
  Phone        string   `json:"phone"`
	Email        string   `json:"email"`
	AcademicPlanCode      []string  `json:academicPlanCode` // 1 & 2
  GREAnalytic  *float64  `json:"greAnalytic"`
  OldGREMath  *float64 `json:"oldGREMath"`
  OldGREVerbal *float64 `json:"oldGREVerbal"`
  NewGREMath *float64 `json:"NewGREMath"`
  NewGREVerbal *float64 `json:"NewGREVerbal"`
  UndergradGPA *float64 `json:"undergradGPA"`
  GradGPA *float64 `json:"gradGPA"`
  ExternalOrgs []string `json:"externalOrgs"`
}

func (self *Application) Id() string {
	return self.PersonId
}

// If we don't get exactly this header, we will abort.
var expectedHdr = []string{"Admit Term", "Person Id", "Last Name", "First Name", "Middle Name", "Gender Code", "Birth Date", "Address Line1", "Address Line2", "City", "State", "Postal Code", "Country", "Citizenship Status", "Preferred Phone", "Application Number", "Preferred Email", "UMass Decision", "Applicant Decision", "Grad Academic Level", "Academic Program", "Academic Plan Code", "Academic Plan Code 2", "Academic Subplan Code", "Academic Subplan Code 2", "GRE Analytic", "Old GRE Math", "Old GRE Verbal", "New GRE Math", "New GRE Verbal", "TOEFL Score", "TOEFL Test Type", "GMAT Integ Rsn", "GMAT Total", "Undergrad GPA (Self-reported)", "Major GPA (Self-Reported)", "Grad GPA (Self-reported)", "Total External Orgs", "External Org 1", "Degree 1", "Degree Date 1", "Converted GPA 1", "Transcript Received 1", "External Org 2", "Degree 2", "Degree Date 2", "Converted GPA 2", "Transcript Received 2", "External Org 3", "Degree 3", "Degree Date 3", "Converted GPA 3", "Transcript Received 3", "External Org 4", "Degree 4", "Degree Date 4", "Converted GPA 4", "Transcript Received 4", "External Org 5", "Degree 5", "Degree Date 5", "Converted GPA 5", "Transcript Received 5"}

// Inverts expectedHdr to map field names to indices
func fieldIndices() map[string]int {
	m := make(map[string]int, len(expectedHdr))
	for i := range(expectedHdr) {
		m[expectedHdr[i]] = i
	}
	return m
}

var hdrIndex = fieldIndices()

// use hdrIndex to lookup row by field. Field must be in expectedHdr.
func index(field string, row []string) string {
	n, found := hdrIndex[field]
	if !found {
		log.Panicf("index got field %v", field)	
	}
  if n >= len(row) {
  	return ""
  }
  return row[n]
}

func removeBlanks(arr []string) []string {
	ret := make([]string,0,len(arr));
	for _, v := range(arr) {
		if v != "" {
			ret = append(ret, v)
		}
	}
	return ret;
}

func rowToStruct(row []string) *Application {
	i := func(f string) string { return index(f, row) }
  num := func(f string) *float64 {
  	s := i(f);
		if s == "" {
		  return nil;
		}

		x, err := strconv.ParseFloat(s, 64)
		if err != nil {
			log.Printf("Could not convert %v to a number (field %v)\n%v\n", s,f,err)
			return nil;
		}

		return &x;

  }
  
  return &Application{
		PersonId: i("Person Id"),
		FirstName: i("First Name"),
		LastName: i("Last Name"),
		Gender: i("Gender Code"),
	  AdmitTerm: i("Admit Term"),
	  Country: i("Country"),
	  Phone: i("Preferred Phone"),
	  Email: i("Preferred Email"),
	  AcademicPlanCode: removeBlanks([]string{i("Academic Plan Code"),
	  								            			 		  i("Academic Plan Code 2")}),
    GREAnalytic: num("GRE Analytic"),
    OldGREMath: num("Old GRE Math"),
    OldGREVerbal: num("Old GRE Verbal"),
    NewGREMath: num("New GRE Math"),
    NewGREVerbal: num("New GRE Verbal"),
    UndergradGPA: num("Undergrad GPA (Self-reported)"),
    GradGPA: num("Grad GPA (Self-reported)"),
    ExternalOrgs: removeBlanks([]string{i("External Org 1"),
    										                i("External Org 2"),
         							    			        i("External Org 3")}),
	}
}

func isHeaderOK(header []string) bool {
	if len(header) != len(expectedHdr) {
		log.Fatalf("Wrong size header (%v columns)", len(header))
		return false
	}

	for i := range(header) {
		if header[i] != expectedHdr[i] {
			log.Fatalf("Invalid header at %v, expected %#v but got %#v", i, 
				expectedHdr[i], header[i])
			return false
		}
	}

	return true
}

func ImportCSV(dbhost, dbport, csvFile string) {
	f, err := os.Open(csvFile)
	if err != nil {
		log.Fatalf("Could not open %v\n%v\n", csvFile, err)
		os.Exit(1)
	}

	r := csv.NewReader(f)
	// These settings are needed to parse what the administration sends us.
	r.TrailingComma = true
	r.FieldsPerRecord = -1

	lines, err := r.ReadAll()
	if err != nil {
		log.Fatalf("Error parsing %v\n%v\n", csvFile, err)
		os.Exit(1)
	}

	if isHeaderOK(lines[0]) == false {
		log.Fatalf("Unexpected header row in %v", csvFile)
		os.Exit(1)
  	}

	dept, err := model.LoadDept(dbhost, dbport)
	if err != nil {
		log.Fatalf("Could not load department.\n%v\n", err)
		os.Exit(1)
	}

  for _, row := range(lines[1:]) {
  	app := rowToStruct(row)
  	err = dept.NewApplication(app)
  	if err != nil {
  		log.Printf("Error creating application %v.\n%v\n", app, err)
  	}
  }

  log.Printf("%v records in %v", len(lines), csvFile)
}

// It should be completely obvious that these regular expressions do not overlap.
var letterRegexp = 
  regexp.MustCompile(`^GCMP_(\d+)_(?:\d+)_(.*)_GS_Adm_Recommendation\.pdf$`)
var resumeRegexp = 
  regexp.MustCompile(`^GCMP_(\d+)_(?:\d+)_(.*)_GS_Adm_Resume\.pdf$`)
var personalStatementRegexp = 
  regexp.MustCompile(`^GCMP_(\d+)_(?:\d+)_(.*)_GS_Adm_Pers_Statemnt\.pdf$`)
var transcriptRegexp = 
  regexp.MustCompile(`^GCMP_(\d+)_(?:\d+)_(.*)_GS_Adm_(?:Unofficial_)?Transcript\.pdf$`)
var applicationRegexp = 
  regexp.MustCompile(`^GCMP_(\d+)_(?:\d+)_(.*)_GS_Adm_Appl\.pdf$`)
var writingSampleRegexp = 
  regexp.MustCompile(`^GCMP_(\d+)_(?:\d+)_(.*)_GS_Adm_Writing_Sample\.pdf$`)
var miscRegexp =
  regexp.MustCompile(`^GCMP_(\d+)_(?:\d+)_(.*)_GS_Adm_Misc\.pdf$`)
var financialRegexp =
  regexp.MustCompile(`^GCMP_(\d+)_(?:\d+)_(.*)_GS_Adm_Fin_Statement\.pdf$`)
var testScoresRegexp =
  regexp.MustCompile(`^GCMP_(\d+)_(?:\d+)_(.*)_GS_Adm_Test_Scores\.pdf$`)

func ImportPDFs(path string) {
	log.Printf("Reading materials from %v.\n", path);

	dir, err := os.Open(path)
	if err != nil {
		log.Fatalf("Could not open directory %v.\n%v", dir, err);
		return;
	}

	files, err := dir.Readdir(-1);
	if err != nil {
		log.Fatalf("Could not read all files.\n%v\n", err);
		return;
	}

	for _, file := range(files) {
		name := file.Name()
		if m := letterRegexp.FindStringSubmatch(name); m != nil {
			continue;
		}	else if m := resumeRegexp.FindStringSubmatch(name); m != nil {
			continue;
		}	else if m := transcriptRegexp.FindStringSubmatch(name); m != nil {
			continue;
		}	else if m := personalStatementRegexp.FindStringSubmatch(name); m != nil {
			continue;
		}	else if m := applicationRegexp.FindStringSubmatch(name); m != nil {
			continue;
		}	else if m := writingSampleRegexp.FindStringSubmatch(name); m != nil {
			continue;
		}	else if m := miscRegexp.FindStringSubmatch(name); m != nil {
			continue;
		}	else if m := financialRegexp.FindStringSubmatch(name); m != nil {
			continue;
		}	else if m := testScoresRegexp.FindStringSubmatch(name); m != nil {
			continue;
		}	else {
			fmt.Printf("Unclassified: %s\n", name);
		}

	}
}
