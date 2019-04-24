package covenantsql

var migrate = []string{
	`
		create table if not exists users (
			id            integer      primary key,
			name          text         default null,
			created_at    timestamp    not null,
			auth_service  text         not null,
			auth_id       text         not null,
			blocked       boolean      not null default false,
			admin         boolean      not null default false,
			avatar        text         not null default ''
		);
		create unique index if not exists name_idx on users(lower(name));
		create unique index if not exists auth_idx on users(auth_service, auth_id);
	`,
	`
		create table if not exists topics (
			id               integer      primary key,
			author_id        bigint       not null references users(id),
			title            text         not null,
			created_at       timestamp    not null,
			last_comment_at  timestamp    not null,
			deleted          boolean      not null default false,
			comment_count    int          not null default 0
		);
		create index if not exists comment_idx on topics(last_comment_at);
	`,
	`
		create table if not exists comments (
			id          integer       primary key,
			topic_id    bigint        not null references topics(id),
			author_id   bigint        not null references users(id),
			content     text          not null,
			created_at  timestamp     not null,
			deleted     boolean       not null default false
		);
		create index if not exists topic_idx on comments(topic_id);
		create index if not exists create_idx on comments(created_at);
	`,
}

var upgrade = []string{
	`alter table topics add column request_hash text not null default '';
	`,
	`alter table comments add column request_hash text not null default '';
	`,
}

var drop = []string{
	`drop table if exists users`,
	`drop table if exists topics`,
	`drop table if exists comments`,
	`drop index if exists name_idx`,
	`drop index if exists auth_idx`,
	`drop index if exists comment_idx`,
	`drop index if exists topic_idx`,
	`drop index if exists create_idx`,
}
