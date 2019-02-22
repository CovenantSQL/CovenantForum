package covenantsql

import "testing"

const (
	testDatabase = "covenantsql://9bbefddeeb545bdf33a519d633f8f78407e8bd3be6754707628a63ed3418c69a"
)

func getTestStore(t *testing.T) (*Store, func()) {
	s, err := Connect(testDatabase)
	if err != nil {
		t.Fatalf(
			"failed to connect to the test covenantsql database: database=%q: %s",
			 testDatabase, err,
		)
	}

	err = s.Reset()
	if err != nil {
		t.Fatalf("failed to reset the test covenantsql database: %s", err)
	}

	teardown := func() {
		err = s.Drop()
		if err != nil {
			t.Fatalf("failed to drop tables of the test covenantsql database: %s", err)
		}
	}

	return s, teardown
}

func TestPlaceholders(t *testing.T) {
	testTable := map[int]string{
		0:  "",
		1:  "?",
		2:  "?,?",
		5:  "?,?,?,?,?",
		-1: "",
	}
	for n, want := range testTable {
		got := placeholders(n)
		if got != want {
			t.Fatalf("got placeholders %q for %d, want %q", got, n, want)
		}
	}
}
