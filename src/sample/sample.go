package sample

import (
	"crypto/rand"
	"fmt"
	"math/big"
	"model"
	"time"
)

const maxTextLen = 300

var randTextBuf []byte

const expectedScoresPerApp = 5

var reviewerNames = [...]string{"George Washington", "John Adams", "Thomas Jefferson", "James Buchanan", "James Madison", "Abraham Lincoln", "James Monroe", "Andrew Johnson", "John Quincy Adams", "Ulysses S. Grant", "Andrew Jackson", "Rutherford B. Hayes", "Martin Van Buren", "James Garfield", "William Henry Harrison", "Chester A. Arthur", "John Tyler", "Grover Cleveland", "James K. Polk", "Benjamin Harrison", "Zachary Taylor", "Grover Cleveland", "Millard Fillmore", "William McKinley", "Franklin Pierce", "Theodore Roosevelt", "John F. Kennedy", "William Howard Taft", "Lyndon B. Johnson", "Woodrow Wilson", "Richard M. Nixon", "Warren G. Harding", "Gerald R. Ford", "Calvin Coolidge"}

var randomText = `
WHEN the people of America reflect that they are now called upon to decide a
question, which, in its consequences, must prove one of the most important that
ever engaged their attention, the propriety of their taking a very
comprehensive, as well as a very serious, view of it, will be evident.  Nothing
is more certain than the indispensable necessity of government, and it is
equally undeniable, that whenever and however it is instituted, the people must
cede to it some of their natural rights in order to vest it with requisite
powers. It is well worthy of consideration therefore, whether it would conduce
more to the interest of the people of America that they should, to all general
purposes, be one nation, under one federal government, or that they should
divide themselves into separate confederacies, and give to the head of each the
same kind of powers which they are advised to place in one national government.
It has until lately been a received and uncontradicted opinion that the
prosperity of the people of America depended on their continuing firmly united,
and the wishes, prayers, and efforts of our best and wisest citizens have been
constantly directed to that object. But politicians now appear, who insist that
this opinion is erroneous, and that instead of looking for safety and happiness
in union, we ought to seek it in a division of the States into distinct
confederacies or sovereignties. However extraordinary this new doctrine may
appear, it nevertheless has its advocates; and certain characters who were much
opposed to it formerly, are at present of the number. Whatever may be the
arguments or inducements which have wrought this change in the sentiments and
declarations of these gentlemen, it certainly would not be wise in the people
at large to adopt these new political tenets without being fully convinced that
they are founded in truth and sound policy.  It has often given me pleasure to
observe that independent America was not composed of detached and distant
territories, but that one connected, fertile, widespreading country was the
portion of our western sons of liberty. Providence has in a particular manner
blessed it with a variety of soils and productions, and watered it with
innumerable streams, for the delight and accommodation of its inhabitants. A
succession of navigable waters forms a kind of chain round its borders, as if
to bind it together; while the most noble rivers in the world, running at
convenient distances, present them with highways for the easy communication of
friendly aids, and the mutual transportation and exchange of their various
commodities.  With equal pleasure I have as often taken notice that Providence
has been pleased to give this one connected country to one united people--a
people descended from the same ancestors, speaking the same language,
professing the same religion, attached to the same principles of government,
very similar in their manners and customs, and who, by their joint counsels,
arms, and efforts, fighting side by side throughout a long and bloody war, have
nobly established general liberty and independence.  This country and this
people seem to have been made for each other, and it appears as if it was the
design of Providence, that an inheritance so proper and convenient for a band
of brethren, united to each other by the strongest ties, should never be split
into a number of unsocial, jealous, and alien sovereignties.  Similar
sentiments have hitherto prevailed among all orders and denominations of men
among us. To all general purposes we have uniformly been one people each
individual citizen everywhere enjoying the same national rights, privileges,
and protection. As a nation we have made peace and war; as a nation we have
vanquished our common enemies; as a nation we have formed alliances, and made
treaties, and entered into various compacts and conventions with foreign
states.  A strong sense of the value and blessings of union induced the people,
at a very early period, to institute a federal government to preserve and
perpetuate it. They formed it almost as soon as they had a political existence;
nay, at a time when their habitations were in flames, when many of their
citizens were bleeding, and when the progress of hostility and desolation left
little room for those calm and mature inquiries and reflections which must ever
precede the formation of a wise and wellbalanced government for a free people.
It is not to be wondered at, that a government instituted in times so
inauspicious, should on experiment be found greatly deficient and inadequate to
the purpose it was intended to answer.  This intelligent people perceived and
regretted these defects. Still continuing no less attached to union than
enamored of liberty, they observed the danger which immediately threatened the
former and more remotely the latter; and being pursuaded that ample security
for both could only be found in a national government more wisely framed, they
as with one voice, convened the late convention at Philadelphia, to take that
important subject under consideration.  This convention composed of men who
possessed the confidence of the people, and many of whom had become highly
distinguished by their patriotism, virtue and wisdom, in times which tried the
minds and hearts of men, undertook the arduous task. In the mild season of
peace, with minds unoccupied by other subjects, they passed many months in
cool, uninterrupted, and daily consultation; and finally, without having been
awed by power, or influenced by any passions except love for their country,
they presented and recommended to the people the plan produced by their joint
and very unanimous councils.  Admit, for so is the fact, that this plan is only
RECOMMENDED, not imposed, yet let it be remembered that it is neither
recommended to BLIND approbation, nor to BLIND reprobation; but to that sedate
and candid consideration which the magnitude and importance of the subject
demand, and which it certainly ought to receive. But this (as was remarked in
the foregoing number of this paper) is more to be wished than expected, that it
may be so considered and examined. Experience on a former occasion teaches us
not to be too sanguine in such hopes. It is not yet forgotten that
well-grounded apprehensions of imminent danger induced the people of America to
form the memorable Congress of 1774. That body recommended certain measures to
their constituents, and the event proved their wisdom; yet it is fresh in our
memories how soon the press began to teem with pamphlets and weekly papers
against those very measures. Not only many of the officers of government, who
obeyed the dictates of personal interest, but others, from a mistaken estimate
of consequences, or the undue influence of former attachments, or whose
ambition aimed at objects which did not correspond with the public good, were
indefatigable in their efforts to pursuade the people to reject the advice of
that patriotic Congress. Many, indeed, were deceived and deluded, but the great
majority of the people reasoned and decided judiciously; and happy they are in
reflecting that they did so.  They considered that the Congress was composed of
many wise and experienced men. That, being convened from different parts of the
country, they brought with them and communicated to each other a variety of
useful information. That, in the course of the time they passed together in
inquiring into and discussing the true interests of their country, they must
have acquired very accurate knowledge on that head. That they were individually
interested in the public liberty and prosperity, and therefore that it was not
less their inclination than their duty to recommend only such measures as,
after the most mature deliberation, they really thought prudent and advisable.
These and similar considerations then induced the people to rely greatly on the
judgment and integrity of the Congress; and they took their advice,
notwithstanding the various arts and endeavors used to deter them from it. But
if the people at large had reason to confide in the men of that Congress, few
of whom had been fully tried or generally known, still greater reason have they
now to respect the judgment and advice of the convention, for it is well known
that some of the most distinguished members of that Congress, who have been
since tried and justly approved for patriotism and abilities, and who have
grown old in acquiring political information, were also members of this
convention, and carried into it their accumulated knowledge and experience.  It
is worthy of remark that not only the first, but every succeeding Congress, as
well as the late convention, have invariably joined with the people in thinking
that the prosperity of America depended on its Union. To preserve and
perpetuate it was the great object of the people in forming that convention,
and it is also the great object of the plan which the convention has advised
them to adopt. With what propriety, therefore, or for what good purposes, are
attempts at this particular period made by some men to depreciate the
importance of the Union? Or why is it suggested that three or four
confederacies would be better than one? I am persuaded in my own mind that the
people have always thought right on this subject, and that their universal and
uniform attachment to the cause of the Union rests on great and weighty
reasons, which I shall endeavor to develop and explain in some ensuing papers.
They who promote the idea of substituting a number of distinct confederacies in
the room of the plan of the convention, seem clearly to foresee that the
rejection of it would put the continuance of the Union in the utmost jeopardy.
That certainly would be the case, and I sincerely wish that it may be as
clearly foreseen by every good citizen, that whenever the dissolution of the
Union arrives, America will have reason to exclaim, in the words of the poet:
"FAREWELL! A LONG FAREWELL TO ALL MY GREATNESS."
`

func randInt(bound int) int {
	n, _ := rand.Int(rand.Reader, big.NewInt(int64(bound)))
	return int(n.Int64())
}

func randText() string {
	return randomText
}

func reviewerIds(revs map[string]string) []string {
	ret := make([]string, len(revs))
	i := 0
	for id, _ := range revs {
		ret[i] = id
		i = i + 1
	}
	return ret
}

func randTime() float64 {
	now := time.Now().Unix()
	delta := int64(randInt(3600 * 24 * 60)) // 3 months
	return float64(now - delta)
}

func LoadRandomComments(dept *model.Dept) {
	apps, err := dept.Applications("0")
	if err != nil {
		panic(fmt.Sprintf("Applications failed, err=%v", err))
	}

	revs, err := dept.GetReviewerIdMap()
	if err != nil {
		panic(fmt.Sprintf("GetReviwerIdMap failed, err=%v", err))
	}

	revIds := reviewerIds(revs)

	for _, app := range apps {
		numComments := randInt(30)
		fmt.Printf("Creating %v comments for %v...\n", numComments, app["embarkId"])
		for i := 0; i < numComments; i = i + 1 {
			revId := revIds[randInt(len(revIds))]
			revName := revs[revId]
			com := &model.Comment{app["embarkId"].(string), model.ReviewerId(revId),
				revName, randTime(), randText()}
			err = dept.NewComment(com)
			if err != nil {
				panic(fmt.Sprintf("NewComment failed, com=%v, err=%v", com, err))
			}
		}
	}
}

func CreateSampleReviewers(dept *model.Dept) {
	pass := "redbull64"
	for i, name := range reviewerNames {
		id := model.ReviewerId(fmt.Sprintf("demo%v", i))
		_, err := dept.NewReviewer(id, name, pass)
		if err != nil {
			fmt.Printf("Could not create reviewer %v: %v\n", name, err)
			continue
		}
		fmt.Printf("New reviewer username: %v, password: %v\n", id, pass)
	}
}

func CreateSampleHighlights(dept *model.Dept) {
	apps, err := dept.Applications("0")
	if err != nil {
		panic(err)
	}
	revs, err := dept.GetReviewerIdMap()
	if err != nil {
		panic(fmt.Sprintf("GetReviwerIdMap failed, err=%v", err))
	}
	expectedHighlights := len(apps) * 2
	events := len(apps) * len(revs) * len(revs)
	Pinv := events / expectedHighlights
	for _, app := range apps {
		for writerId, writerName := range revs {
			for readerId, _ := range revs {
				if randInt(Pinv) != 0 {
					continue
				}
				hl := &model.Highlight{app["embarkId"].(string),
					model.ReviewerId(readerId), model.ReviewerId(writerId),
					writerName, randTime()}
				err = dept.SetHighlight(hl)
				if err != nil {
					panic(err)
				}
			}
		}
	}
}

func CreateSampleScores(dept *model.Dept) {
	apps, _ := dept.Applications("0")
	revs, _ := dept.GetReviewerIdMap()
	Pinv := len(revs) / expectedScoresPerApp
	for _, app := range apps {
		for readerId, _ := range revs {
			if randInt(Pinv) != 0 {
				continue
			}
			s := randInt(11)
			score := &model.Score{app["embarkId"].(string),
				model.ReviewerId(readerId), "rating", &s}
			err := dept.SetScore(score)
			if err != nil {
				panic(err)
			}
		}
	}
}

func Populate(dept *model.Dept) {
	fmt.Println("Creating reviewers ...")
	CreateSampleReviewers(dept)
	fmt.Println("Creating sample comments ...")
	LoadRandomComments(dept)
	fmt.Println("Creating sample highlights ...")
	CreateSampleHighlights(dept)
	fmt.Println("Creating sample scores ...")
	CreateSampleScores(dept)
}

/*
func Make(prefix string, numApps int) os.Error {
  dept, err := model.NewDept("localhost", "5984", prefix)
  if err != nil {
    panic(fmt.Sprintf("NewDept failed, err=%v", err))
  }

  apps := make([]*Application, numApps)
  for i, app := range(apps) {
    app = &Application{i, randFirstName(), randLastName(), randEmail(), randGPA(),
      randGRE(), randGRE(), randCountry(), 
    err = dept.NewApplication(app)
    if err != nil {
      panic(fmt.Sprintf("NewApplication failed, app=%v, err=%v", app, err))
    }
  }
}
*/
