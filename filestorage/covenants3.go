package filestorage

import (
	"database/sql"
	"fmt"
	"io"
	"io/ioutil"
	"log"
	"net/http"
	"strings"

	"github.com/CovenantSQL/CovenantSQL/client"
)

// CovenantS3 is an CovenantS3 file storage.
type CovenantS3 struct {
	dsn          string
	bucket       string
	httpEndpoint string
	db           *sql.DB
}

// NewCovenantS3 returns a new CovenantS3 file storage.
func NewCovenantS3(dsn, configFile, masterKey, httpEndpoint, bucket string) (*CovenantS3, error) {
	err := client.Init(configFile, []byte(masterKey))
	if err != nil && err != client.ErrAlreadyInitialized {
		log.Fatal(err)
	}

	db, err := sql.Open("covenantsql", dsn)
	if err != nil {
		return nil, err
	}

	if err := db.Ping(); err != nil {
		return nil, err
	}

	s := &CovenantS3{
		dsn:          dsn,
		httpEndpoint: strings.TrimSuffix(httpEndpoint, "/"),
		db:           db,
		bucket:       bucket,
	}

	err = s.Migrate()
	if err != nil {
		return nil, err
	}

	return s, nil
}

// Migrate ensures the tables is created.
func (s *CovenantS3) Migrate() error {
	for _, q := range migrate {
		_, err := s.db.Exec(q)
		if err != nil {
			return fmt.Errorf("sql exec error: %s; query: %q", err, q)
		}
	}

	return nil
}

// Save saves data from r to file with the given path.
func (s *CovenantS3) Save(path string, r io.Reader) error {
	content, err := ioutil.ReadAll(r)
	if err != nil {
		return fmt.Errorf("failed to read content: %s", err)
	}
	_, err = s.db.Exec(
		"insert into s3(bucket, path, size, data) values (?, ?, ?, ?)",
		s.bucket, path, len(content), content)
	if err != nil {
		return fmt.Errorf("failed to upload object to CovenantS3: %s", err)
	}
	return nil
}

// Remove removes the file with the given path.
func (s *CovenantS3) Remove(path string) error {
	_, err := s.db.Exec("delete from s3 where bucket = ? and path = ?", s.bucket, path)
	if err != nil {
		return fmt.Errorf("failed to delete object from CovenantS3: %s", err)
	}
	return nil
}

// URL returns an URL of the file with the given path.
func (s *CovenantS3) URL(path string) string {
	return fmt.Sprintf("%s/%s", s.httpEndpoint, path)
}

// GetHTTPHandler returns the static http.HandlerFunc
func (s *CovenantS3) GetHTTPHandler(stripPrefix string) http.HandlerFunc {
	return func(writer http.ResponseWriter, request *http.Request) {
		var data []byte
		path := strings.TrimPrefix(request.URL.Path, stripPrefix)
		row := s.db.QueryRow(
			"select data from s3 where bucket = ? and path = ?",
			s.bucket, path)
		err := row.Scan(&data)
		if err == sql.ErrNoRows {
			writer.WriteHeader(http.StatusNotFound)
			return
		} else if err != nil {
			writer.WriteHeader(http.StatusInternalServerError)
			return
		}
		_, _ = writer.Write(data)
	}
}
