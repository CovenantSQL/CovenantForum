const COMMENTS_PER_PAGE = 10
const API_HOST = window.API_HOST
const findCommentHashByCreatedAt = (createdAt) => {
  let sqls = db.get('sql').value()
  let hash = ''
  sqls.forEach(sql => {
    sql.queries.forEach(query => {
      if (_.startsWith(query.pattern, 'insert into comments') && _.get(query, ['args', 3, 'value']) === createdAt) {
        hash = sql.hash
      }
    })
  })
  return hash
}

var BebopComments = Vue.component("bebop-comments", {
  template: `
    <div class="container content-container">

      <div v-if="!dataReady" class="loading-info">
        <div v-if="error" >
          <p class="text-danger">
            Sorry, could not load that topic. Please check your connection.
          </p>
          <a class="btn btn-primary btn-sm" role="button" @click="load">
            <i class="fa fa-refresh"></i> Try Again
          </a>
        </div>
        <div v-else>
          <i class="fa fa-circle-o-notch fa-spin fa-3x fa-fw"></i>
        </div>
      </div>
      <div v-else>

        <h2>{{topic.title}}</h2>

        <nav v-if="lastPage > 1">
          <ul class="pagination pagination-sm">
            <li v-for="p in pagination" :class="{active: page === p}">
              <span v-if="p === '...'">…</span>
              <router-link v-if="p !== '...'" :to="'/t/' + topicId + '/p/' + p">{{p}}</router-link>
            </li>
          </ul>
        </nav>

        <div v-for="comment in comments" class="card comments-comment" :id="'comment-' + comment.id">

          <div class="avatar-block">
            <div class="cqldb comment">
              <a target="_blank" :href="comment.createdAt | getCommentSQLRequestHref"  v-bind:class="{ disabled: isCommentSQLRequestHrefEmpty(comment.createdAt) }">
                <img src="https://developers.covenantsql.io/img/logo.svg" alt="logo" style="width: 19px;">CovenantSQL
              </a>
            </div>
            <div class="avatar-block-l">
              <img v-if="users[comment.authorId].avatar" class="img-circle" :src="users[comment.authorId].avatar" width="35" height="35"> 
              <img v-else class="img-circle" src="data:image/gif;base64,R0lGODlhAQABAIAAAP///wAAACH5BAEAAAAALAAAAAABAAEAAAICRAEAOw==" width="35" height="35"> 
            </div>
            <div class="avatar-block-r">
              <div class="comments-comment-author">{{users[comment.authorId].name}}</div>
              <div class="comments-comment-date">
                commented <span :title="comment.createdAt|formatTime">{{comment.createdAt|formatTimeAgo}}</span>
              </div>
            </div>
          </div>

          <div class="comments-comment-content" v-html="comment.content">
          </div>

          <div v-if="auth.authenticated && auth.user.admin" class="comments-comment-admin-tools">
            <a v-if="topic.commentCount > 1" class="a-tool" role="button" @click="delComment(comment.id)"><i class="fa fa-times" aria-hidden="true"></i> delete comment</a>
            <span v-if="topic.commentCount > 1" class="info-separator"> | </span>
            <router-link :to="'/u/' + users[comment.authorId].id" class="a-tool"><i class="fa fa-user" aria-hidden="true"></i> user profile</router-link>
          </div>
        
        </div>

        <div v-if="auth.authenticated && page === lastPage" class="comments-comment-new">
          <router-link :to="'/new-comment/' + topicId" class="btn btn-primary btn-sm">
            <i class="fa fa-reply" aria-hidden="true"></i>
            Reply
          </router-link>
        </div>

        <nav v-if="lastPage > 1">
          <ul class="pagination pagination-sm">
            <li v-for="p in pagination" :class="{active: page === p}">
              <span v-if="p === '...'">…</span>
              <router-link v-if="p !== '...'" :to="'/t/' + topicId + '/p/' + p">{{p}}</router-link>
            </li>
          </ul>
        </nav>

      </div>

    </div>
  `,

  props: ["config", "auth", "dbid"],

  data: function () {
    return {
      topic: {},
      topicReady: false,
      comments: [],
      commentCount: 0,
      commentsReady: false,
      users: {},
      usersReady: false,
      error: false,
    };
  },

  computed: {
    dataReady: function () {
      return this.topicReady && this.commentsReady && this.usersReady;
    },

    topicId: function () {
      var topicId = parseInt(this.$route.params.topic, 10);
      if (!topicId) {
        return 0;
      }
      return topicId;
    },

    page: function () {
      var page = parseInt(this.$route.params.page, 10);
      if (!page || page < 1) {
        return 1;
      }
      return page;
    },

    lastPage: function () {
      if (!this.commentsReady) {
        return 1;
      }
      var p = Math.floor((this.commentCount - 1) / COMMENTS_PER_PAGE) + 1;
      if (p < 1) {
        p = 1;
      }
      return p;
    },

    pagination: function () {
      if (!this.commentsReady) {
        return [];
      }
      return getPagination(this.page, this.lastPage);
    },
  },

  watch: {
    page: function (val) {
      this.load();
    },
    topicId: function (val) {
      this.load();
    },
    dataReady: function (val) {
      if (val && this.$route.params.comment) {
        this.$nextTick(() => {
          $("html, body").animate(
            {
              scrollTop: $("#comment-" + this.$route.params.comment).offset().top,
            },
            500
          );
        });
      }
    },
  },

  created: function () {
    this.load();
  },

  filters: {
    getCommentSQLRequestHref: function (createdAt) {
      let hash = findCommentHashByCreatedAt(createdAt)
      console.log('// found hash:', hash)
      return !!hash ? `${window.API_HOST}/dbs/${window.DBID}/requests/${hash}` : ''
    },
  },

  methods: {
    load: function () {
      this.topic = {};
      this.topicReady = false;
      this.comments = [];
      this.commentCount = 0;
      this.commentsReady = false;
      this.users = {};
      this.usersReady = false;
      this.waitNewComment = false;
      this.error = false;

      // async calls
      this.getTopic();
      this.getComments().then(this.getCommentSQLQueries);
    },

    isCommentSQLRequestHrefEmpty: function (createdAt) {
      return findCommentHashByCreatedAt(createdAt) === ''
    },
    getCommentSQLQueries: function () {
      this.comments.forEach(comment => {
        const timestamp = (new Date(comment.createdAt)).getTime()
        const possibleHeight = this.computeTimeHeight(timestamp)
        console.log('// -- current comment possible height:', possibleHeight)

        this.getTimeRelatedBlocks(possibleHeight)
      })
    },
    writeSQL: function (block) {
      if (!_.isEmpty(block)) {
        block.queries.forEach(q => {
          console.log('// write sql db', q.request)
          db.get('sql').push(q.request).write()
        })
      }
    },
    getTimeRelatedBlocks: function (height, offset = 1) {
      // get [height - offset, height, height + offset] blocks
      let heightArr = []
      for (let i = height - offset; i <= height + offset; i++) {
        if (i > -1) {
          heightArr.push(i)
        }
      }

      let promises = []
      heightArr.forEach(h => {
        if (!db.get('blocks').find({ count: h }).value()) {
          let url = window.BLOCK_API(h)

          let promise = new Promise((resolve, reject) => {
            fetch(url).then(res => res.json()).then(data => {
              const block = _.get(data, ['data', 'block'])
              console.log('// getTimeRelatedBlocks: ', block)
              db.get('blocks').push(block).write()

              // writeSQL
              this.writeSQL(block)
              resolve(block)
            }).catch(e => {
              console.error(e)
              reject(e)
            })
          })

          return promise
        }
      })

      return Promise.all(promises)
    },
    computeTimeHeight: function (unixTimestamp) {
      let headTimestamp = db.get('head').value().timestamp
      let headHeight = db.get('head').value().count

      if (headTimestamp && headHeight) {
        let offset = Math.floor((headTimestamp - unixTimestamp) / (1000 * 60))
        return headHeight - offset
      }
    },

    getTopic: function () {
      var url = "api/v1/topics/" + this.topicId;
      this.$http.get(url).then(
        response => {
          this.topic = response.body.topic;
          this.topicReady = true;
        },
        response => {
          this.error = true;
          console.log("ERROR: getTopic: " + JSON.stringify(response.body));
        }
      );
    },

    getComments: function () {
      var url = "api/v1/comments?topic=" + this.topicId + "&limit=" + COMMENTS_PER_PAGE;
      if (this.page > 0) {
        var offset = (this.page - 1) * COMMENTS_PER_PAGE;
        url += "&offset=" + offset;
      }
      return this.$http.get(url).then(
        response => {
          this.comments = response.body.comments;
          this.commentCount = response.body.count;
          for (var i = 0; i < this.comments.length; i++) {
            this.comments[i].content = marked(this.comments[i].content, {
              sanitize: true,
              breaks: true,
            });
          }
          this.commentsReady = true;

          if (this.page > this.lastPage) {
            this.$parent.$router.replace("/t/" + this.topicId + "/p/" + this.lastPage);
            return;
          }

          this.getUsers();
        },
        response => {
          this.error = true;
          console.log("ERROR: getComments: " + JSON.stringify(response.body));
        }
      );
    },

    getUsers: function () {
      var url = "api/v1/users";
      var ids = [];
      for (var i = 0; i < this.comments.length; i++) {
        ids.push(this.comments[i].authorId);
      }
      ids = ids.filter((v, i, a) => a.indexOf(v) === i);
      if (ids.length === 0) {
        this.users = {};
        this.usersReady = true;
        return;
      }
      url += "?ids=" + ids.join(",");
      this.$http.get(url).then(
        response => {
          var users = {};
          for (var i = 0; i < response.body.users.length; i++) {
            users[response.body.users[i].id] = response.body.users[i];
          }
          this.users = users;
          this.usersReady = true;
        },
        response => {
          this.error = true;
          console.log("ERROR: getUsers: " + JSON.stringify(response.body));
        }
      );
    },

    delComment: function (id) {
      if (!confirm("Are you sure you want to delete comment " + id + "?")) {
        return;
      }
      var url = "api/v1/comments/" + id;
      this.$http.delete(url).then(
        response => {
          this.load();
        },
        response => {
          console.log("ERROR: delComment: " + JSON.stringify(response.body));
        }
      );
    },
  },
});
