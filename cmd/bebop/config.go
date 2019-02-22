package main

import (
	"fmt"
	"github.com/CovenantSQL/bebop/store/covenantsql"
	"io/ioutil"
	"os"

	"github.com/CovenantSQL/bebop/config"
	"github.com/CovenantSQL/bebop/filestorage"
	"github.com/CovenantSQL/bebop/store"
	"github.com/CovenantSQL/bebop/store/mysql"
	"github.com/CovenantSQL/bebop/store/postgresql"
)

const configFile = "bebop.conf"

// initConfig creates an initial configuration file inside the current directory.
func initConfig() {
	if _, err := os.Stat(configFile); !os.IsNotExist(err) {
		logger.Fatalf("configuration file already exists: %s", configFile)
	}

	logger.Printf("creating initial configuration: %s", configFile)

	cfg, err := config.Init()
	if err != nil {
		logger.Fatalf("failed to generate initial configuration: %s", err)
	}

	err = ioutil.WriteFile(configFile, []byte(cfg), 0666)
	if err != nil {
		logger.Fatalf("failed to write configuration file: %s", err)
	}
}

// getConfig loads configuration from environment variables or from file.
func getConfig() (cfg *config.Config, err error) {
	if *useEnvConfig {
		cfg, err = config.ReadEnv()
	} else {
		cfg, err = config.ReadFile(configFile)
	}
	return cfg, err
}

// genKey generates a random 32-byte hex-encoded key.
func genKey() {
	logger.Printf("key: %s", config.GenKeyHex(32))
}

func getFileStorage(cfg *config.Config) (filestorage.FileStorage, error) {
	switch cfg.FileStorage.Type {
	case "local":
		return filestorage.NewLocal(
			cfg.FileStorage.Local.Dir,
			cfg.BaseURL+"/static",
		)
	case "google_cloud_storage":
		return filestorage.NewGoogleCloudStorage(
			cfg.FileStorage.GoogleCloudStorage.ServiceAccountFile,
			cfg.FileStorage.GoogleCloudStorage.Bucket,
		)
	case "amazon_s3":
		return filestorage.NewAmazonS3(
			cfg.FileStorage.AmazonS3.AccessKey,
			cfg.FileStorage.AmazonS3.SecretKey,
			cfg.FileStorage.AmazonS3.Region,
			cfg.FileStorage.AmazonS3.Bucket,
		)
	}
	return nil, fmt.Errorf("unknown file storage type: %s", cfg.FileStorage.Type)
}

func getStore(cfg *config.Config) (store.Store, error) {
	switch cfg.Store.Type {
	case "mysql":
		return mysql.Connect(
			cfg.Store.MySQL.Address,
			cfg.Store.MySQL.Username,
			cfg.Store.MySQL.Password,
			cfg.Store.MySQL.Database,
		)
	case "postgresql":
		return postgresql.Connect(
			cfg.Store.PostgreSQL.Address,
			cfg.Store.PostgreSQL.Username,
			cfg.Store.PostgreSQL.Password,
			cfg.Store.PostgreSQL.Database,
			cfg.Store.PostgreSQL.SSLMode,
			cfg.Store.PostgreSQL.SSLRootCert,
		)
	case "covenantsql":
		return covenantsql.Connect(
			cfg.Store.CovenantSQL.Database,
			cfg.Store.CovenantSQL.Config,
			cfg.Store.CovenantSQL.MasterKey,
		)
	}

	return nil, fmt.Errorf("unknown store type: %s", cfg.Store.Type)
}
