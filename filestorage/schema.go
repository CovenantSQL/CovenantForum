package filestorage

var migrate = []string{
	`
		create table if not exists s3 (
			id            integer      primary key,
            bucket        text         not null,
			path          text         not null,
            size          integer,
			data          blob
		);
		create index if not exists path_idx on s3(path);
		create unique index if not exists bucket_path_idx on s3(bucket, path);
	`,
}

var drop = []string{
	`drop table if exists s3`,
	`drop index if exists path_idx`,
	`drop index if exists bucket_path_idx`,
}
