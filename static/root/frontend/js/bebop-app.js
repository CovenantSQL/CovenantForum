const BEBOP_LOCAL_STORAGE_TOKEN_KEY = "bebop_auth_token";
const BEBOP_OAUTH_RESULT_COOKIE = "bebop_oauth_result";

// global vars
window.API_HOST = "http://localhost:3000"
window.DBID = ""
window.HEAD_API = () => `${window.API_HOST}/apiproxy.covenantsql/v2/head/${window.DBID}`
window.BLOCK_API = (height) => `${window.API_HOST}/apiproxy.covenantsql/v3/count/${window.DBID}/${height}?page=1&size=999`

// lowdb
const adapter = new LocalStorage('db')
window.db = low(adapter)
// init db
db.defaults({ blocks: [], sql: [], head: {} }).write()

var BebopApp = new Vue({
  el: "#app",

  template: `
    <div>
      <bebop-nav :config="config" :auth="auth"></bebop-nav>
      <bebop-username-modal ref="usernameModal"></bebop-username-modal>
      <div id="main">
        <router-view :config="config" :auth="auth" :rawConfig="rawConfig"></router-view>
      </div>
      
      <footer class="nav-footer" id="footer">
        <section class="sitemap">
        <a href="#/">
          <img svg-inline class="logoicon" src="http://developers.covenantsql.io/img/logo.svg" alt="covenantsql-logoicon">
        </a>
        <div>
          <h3>Docs</h3>
          <a href="https://developers.covenantsql.io/docs/intro">Getting Started</a>
          <a href="https://developers.covenantsql.io/docs/api-json-rpc">API Reference</a>
        </div>
        <div>
          <h3>Community</h3>
          <a
            href="https://stackoverflow.com/search?q=covenantsql"
            target="_blank"
            rel="noreferrer noopener"
          >Stack Overflow</a>
          <a href="https://gitter.im/CovenantSQL/CovenantSQL">Gitter Chat</a>
          <a href="https://twitter.com/CovenantLabs" target="_blank" rel="noreferrer noopener">Twitter</a>
        </div>
        <div>
          <h3>More</h3>
          <a href="https://medium.com/@covenant_labs">Blog</a>
          <a
            class="github-button"
            href="https://github.com/CovenantSQL/CovenantSQL"
            data-icon="octicon-star"
            data-count-href="/CovenantSQL/CovenantSQL/stargazers"
            data-show-count="true"
            data-count-aria-label="# stargazers on GitHub"
            aria-label="Star this project on GitHub"
          >Star</a>
        </div>
      </section>

      <a
        href="https://covenantsql.io"
        target="_blank"
        rel="noreferrer noopener"
        class="covenant-icon"
      >
        <img
          src="https://developers.covenantsql.io/img/horizontal_logo.svg"
          alt="CovenantSQL"
          width="170"
          height="45"
        >
      </a>
      </footer>

    </div>
  `,

  router: new VueRouter({
    routes: [
      { path: "/", component: BebopTopics },
      { path: "/p/:page", component: BebopTopics },
      { path: "/t/:topic", component: BebopComments },
      { path: "/t/:topic/p/:page", component: BebopComments },
      { path: "/t/:topic/p/:page/c/:comment", component: BebopComments },
      { path: "/new-topic", component: BebopNewTopic },
      { path: "/new-comment/:topic", component: BebopNewComment },
      { path: "/me", component: BebopUser },
      { path: "/u/:user", component: BebopUser },
    ],
    scrollBehavior: function (to, from, savedPosition) {
      if (savedPosition) {
        return savedPosition;
      } else {
        return { x: 0, y: 0 };
      }
    },
  }),

  data: function () {
    return {
      config: {
        title: "",
        oauth: [],
      },
      rawConfig: {},
      auth: {
        authenticated: false,
        user: {},
      }
    };
  },

  mounted: function () {
    this.getConfig().then(this.getBlockHead)
    this.checkAuth()

    window.getBlockHead = this.getBlockHead
  },

  methods: {
    getBlockHead: function () {
      if (window.DBID) {
        let url = HEAD_API()
        console.log('// get current lead block for ', DBID)

        fetch(url).then(res => res.json()).then((d) => {
          let head = _.get(d, 'data.block', {})
          console.log('// current head block', head)
          db.set('head', head).write()
        }).catch(e => {
          console.error(e)
        })
      }
    },

    getConfig: function () {
      return this.$http.get("config.json").then(
        response => {
          this.config = response.body
          console.log('// raw config response:', response.body.raw)
          this.rawConfig = response.body.raw

          let _dsn = _.get(this.rawConfig, ['Store', 'CovenantSQL', 'Database'], '')
          window.DBID = _dsn.split('//')[1] || ''

          if (this.config.title) {
            document.title = this.config.title;
          }
        },
        response => {
          console.log("ERROR: getConfig: " + response.status);
        }
      );
    },

    signIn: function (provider) {
      window.open("oauth/begin/" + provider, "", "width=800,height=600");
    },

    signOut: function () {
      localStorage.removeItem(BEBOP_LOCAL_STORAGE_TOKEN_KEY);
      Vue.http.headers.common["Authorization"] = "";
      this.auth = {
        authenticated: false,
        user: {},
      };
    },

    oauthEnd: function () {
      var result = this.getCookieByName(BEBOP_OAUTH_RESULT_COOKIE);
      var parts = result.split(":");

      if (parts.length !== 2) {
        this.oauthError("Unknown");
        return;
      }

      if (parts[0] === "error") {
        this.oauthError(parts[1]);
        return;
      }

      if (parts[0] !== "success") {
        this.oauthError("Unknown");
        return;
      }

      this.oauthSuccess(parts[1]);
    },

    getCookieByName: function (name) {
      var value = "; " + document.cookie;
      var parts = value.split("; " + name + "=");
      if (parts.length === 2) return parts.pop().split(";").shift();
    },

    oauthSuccess: function (token) {
      localStorage.setItem(BEBOP_LOCAL_STORAGE_TOKEN_KEY, token);
      this.checkAuth();
    },

    oauthError: function (error) {
      if (error === "UserBlocked") {
        console.log("oauth error: USER IS BLOCKED");
      } else {
        console.log("oauth error: " + error);
      }
      this.signOut();
    },

    checkAuth: function () {
      var token = localStorage.getItem(BEBOP_LOCAL_STORAGE_TOKEN_KEY);
      if (token) {
        Vue.http.headers.common["Authorization"] = "Bearer " + token;
      }
      this.getMe();
    },

    getMe: function () {
      this.$http.get("api/v1/me").then(
        response => {
          this.auth = {
            authenticated: response.body.authenticated ? true : false,
            user: response.body.authenticated ? response.body.user : {},
          };
          if (this.auth.authenticated && this.auth.user.name === "") {
            this.setMyName();
          }
        },
        response => {
          console.log("ERROR: getMe: " + JSON.stringify(response.body));
          if (response.status === 401) {
            this.signOut();
          }
        }
      );
    },

    setMyName: function () {
      this.$refs.usernameModal.show(this.auth.user.id, "", success => {
        if (!success) {
          this.signOut();
        }
        this.getMe();
      });
    },
  },
});

function bebopOAuthEnd() {
  BebopApp.oauthEnd();
}
