package main

import (
	"fmt"
	"github.com/CovenantSQL/CovenantForum/store/covenantsql"
	"io/ioutil"
	"os"

	"github.com/CovenantSQL/CovenantForum/config"
	"github.com/CovenantSQL/CovenantForum/filestorage"
	"github.com/CovenantSQL/CovenantForum/store"
)

const configFile = "forum.conf"

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
	case "covenant_s3":
		return filestorage.NewCovenantS3(
			cfg.FileStorage.CovenantS3.Database,
			cfg.FileStorage.CovenantS3.Config,
			cfg.FileStorage.CovenantS3.MasterKey,
			cfg.BaseURL+"/covenant_static",
			"default",
		)
	}
	return nil, fmt.Errorf("unknown file storage type: %s", cfg.FileStorage.Type)
}

func getStore(cfg *config.Config) (store.Store, error) {
	switch cfg.Store.Type {
	case "covenantsql":
		return covenantsql.Connect(
			cfg.Store.CovenantSQL.Database,
			cfg.Store.CovenantSQL.Config,
			cfg.Store.CovenantSQL.MasterKey,
		)
	}

	return nil, fmt.Errorf("unknown store type: %s", cfg.Store.Type)
}
