// ==UserScript==
// @name         blivemedal
// @namespace    http://tampermonkey.net/
// @version      0.2
// @description  拯救B站直播换牌子的用户体验
// @author       xfgryujk
// @include      /https?:\/\/live\.bilibili\.com\/?\??.*/
// @include      /https?:\/\/live\.bilibili\.com\/\d+\??.*/
// @include      /https?:\/\/live\.bilibili\.com\/(blanc\/)?\d+\??.*/
// @require      https://unpkg.com/vuex@3.6.0/dist/vuex.js
// @require      https://cdn.jsdelivr.net/npm/axios@0.21.0/dist/axios.min.js
// @grant        none
// ==/UserScript==

(function() {
  function main() {
    initLib()
    initCss()
    waitForLoaded(() => {
      Vue.use(Vuex)
      initUi()
    })
  }

  function initLib() {
    let scriptElement = document.createElement('script')
    scriptElement.src = 'https://cdn.jsdelivr.net/npm/vue@2.6.12/dist/vue.js'
    document.head.appendChild(scriptElement)

    let linkElement = document.createElement('link')
    linkElement.rel = 'stylesheet'
    linkElement.href = 'https://unpkg.com/element-ui@2.14.1/lib/theme-chalk/index.css'
    document.head.appendChild(linkElement)
    
    scriptElement = document.createElement('script')
    scriptElement.src = 'https://unpkg.com/element-ui@2.14.1/lib/index.js'
    document.head.appendChild(scriptElement)
  }

  function initCss() {
    let css = `
      /* 屏蔽原来的牌子按钮 */
      .medal-section {
        display: none !important;
      }

      /* 屏蔽选牌子对话框，防止刷新时闪烁 */
      .dialog-ctnr.medal {
        display: none !important;
      }
    `
    let styleElement = document.createElement('style')
    styleElement.innerText = css
    document.head.appendChild(styleElement)
  }

  function waitForLoaded(callback, timeout=10 * 1000) {
    let startTime = new Date()
    function poll() {
      if (isLoaded()) {
        callback()
        return
      }

      if (new Date() - startTime > timeout) {
        return
      }
      setTimeout(poll, 1000)
    }
    poll()
  }

  function isLoaded() {
    if (window.ELEMENT === undefined) {
      return false
    }
    if (document.querySelector('#control-panel-ctnr-box') === null) {
      return false
    }
    return true
  }

  let store = null
  function getStore() {
    if (store === null) {
      store = new Vuex.Store({
        state: {
          medals: [],
          curMedal: null
        },
        mutations: {
          setMedals(state, medals) {
            state.medals = medals
          },
          setCurMedal(state, curMedal) {
            state.curMedal = curMedal
          }
        },
        actions: {
          async updateMedals({ commit }) {
            commit('setMedals', await getMedals())
          },
          async updateCurMedal({ commit }) {
            commit('setCurMedal', await getCurMedal())
          }
        }
      })
    }
    return store
  }

  function initUi() {
    let panelElement = document.querySelector('#control-panel-ctnr-box')
    let myMedalButtonElement = document.createElement('div')
    panelElement.appendChild(myMedalButtonElement)

    new Vue({
      el: myMedalButtonElement,
      store: getStore(),
      components: {
        MedalDialog
      },
      template: `
        <div>
          <el-button type="primary" style="font-size: 12px; min-width: 80px; height: 24px; padding: 6px 12px;"
            @click="showMedalDialog"
          >
            {{ curMedal === null ? '勋章' : curMedal.medal_name }}
          </el-button>
          <medal-dialog ref="medalDialog"></medal-dialog>
        </div>
      `,
      computed: {
        ...Vuex.mapState({
          curMedal: state => state.curMedal
        })
      },
      created() {
        this.updateCurMedal()
      },
      methods: {
        ...Vuex.mapActions([
          'updateCurMedal'
        ]),
        showMedalDialog() {
          this.$refs.medalDialog.showDialog()
        }
      }
    })
  }

  let MedalDialog = {
    name: 'MedalDialog',
    template: `
      <el-dialog :visible.sync="dialogVisible" title="我的粉丝勋章" top="60px" width="850px" :modal="false">
        <el-table :data="sortedMedals" stripe height="70vh">
          <el-table-column label="勋章" prop="medal_name" width="100" sortable
            :sort-method="(a, b) => a.medal_name.localeCompare(b.medal_name)"
          >
            <template slot-scope="scope">
              <el-tag :type="scope.row.is_lighted ? '' : 'info'">{{ scope.row.medal_name }}</el-tag>
            </template>
          </el-table-column>
          <el-table-column label="等级" prop="level" width="80" sortable></el-table-column>
          <el-table-column label="主播昵称" prop="target_name" width="200" sortable
            :sort-method="(a, b) => a.target_name.localeCompare(b.target_name)"
          >
            <template slot-scope="scope">
              <el-link type="primary" :underline="false" target="_blank" :href="'https://live.bilibili.com/' + scope.row.roomid">
                {{ scope.row.target_name }}
              </el-link>
            </template>
          </el-table-column>
          <el-table-column label="亲密度/原力值" prop="intimacy" width="140" sortable>
            <template slot-scope="scope">
              {{ scope.row.intimacy }} / {{ scope.row.next_intimacy }}
            </template>
          </el-table-column>
          <el-table-column label="本日亲密度/原力值" prop="today_intimacy" width="160" sortable>
            <template slot-scope="scope">
              {{ scope.row.today_intimacy }} / {{ scope.row.day_limit }}
            </template>
          </el-table-column>
          <el-table-column label="操作" width="120">
            <template slot-scope="scope">
              <el-button v-if="curMedal !== null && scope.row.medal_id === curMedal.medal_id"
                type="info" size="mini" @click="takeOffMedal"
              >取消佩戴</el-button>
              <el-button v-else type="primary" size="mini" @click="wearMedal(scope.row)">佩戴</el-button>
            </template>
          </el-table-column>
        </el-table>
      </el-dialog>
    `,
    data() {
      return {
        dialogVisible: false
      }
    },
    computed: {
      ...Vuex.mapState({
        medals: state => state.medals,
        curMedal: state => state.curMedal
      }),
      sortedMedals() {
        const CUR_ROOM_ID = window.__NEPTUNE_IS_MY_WAIFU__.roomInfoRes.data.room_info.room_id
        let curMedal = []
        let curRoomMedal = []
        let medals = []
        for (let medal of this.medals) {
          if (this.curMedal !== null && medal.medal_id === this.curMedal.medal_id) {
            curMedal.push(medal)
          } else if (medal.roomid === CUR_ROOM_ID) {
            curRoomMedal.push(medal)
          } else {
            medals.push(medal)
          }
        }
        // 剩下的按上次佩戴时间降序排序
        medals.sort((a, b) => b.last_wear_time - a.last_wear_time)
        return [...curMedal, ...curRoomMedal, ...medals]
      }
    },
    methods: {
      ...Vuex.mapActions({
        doUpdateMedals: 'updateMedals',
        doUpdateCurMedal: 'updateCurMedal'
      }),
      showDialog() {
        this.updateMedals()
        this.updateCurMedal()
        this.dialogVisible = true
      },
      async updateMedals() {
        try {
          await this.doUpdateMedals()
        } catch (e) {
          this.$message.error(e)
        }
      },
      async updateCurMedal() {
        try {
          await this.doUpdateCurMedal()
        } catch (e) {
          this.$message.error(e)
        }
      },
      async wearMedal(medal) {
        try {
          await wearMedal(medal.medal_id)
        } catch (e) {
          this.$message.error(e)
          return
        }
        this.updateCurMedal()
      },
      async takeOffMedal() {
        try {
          await takeOffMedal()
        } catch (e) {
          this.$message.error(e)
          return
        }
        this.updateCurMedal()
      }
    }
  }

  let apiClient = axios.create({
    baseURL: 'https://api.live.bilibili.com',
    withCredentials: true
  })

  async function getMedals() {
    let rsp = (await apiClient.get('/fans_medal/v5/live_fans_medal/iApiMedal?page=1&pageSize=1000')).data
    if (rsp.code !== 0) {
      throw rsp.message
    }
    return rsp.data.fansMedalList
  }

  async function getCurMedal() {
    let rsp = (await apiClient.get('/live_user/v1/UserInfo/get_weared_medal')).data
    if (rsp.code !== 0) {
      throw rsp.message
    }
    let curMedal = rsp.data
    if (curMedal.medal_id === undefined) {
      // 没佩戴牌子
      curMedal = null
    }
    return curMedal
  }

  async function wearMedal(medalId) {
    let csrfToken = getCsrfToken()
    let data = new FormData()
    data.append('medal_id', medalId)
    data.append('csrf_token', csrfToken)
    data.append('csrf', csrfToken)
    let rsp = (await apiClient.post('/xlive/web-room/v1/fansMedal/wear', data)).data
    if (rsp.code !== 0) {
      throw rsp.message
    }
    refreshBilibiliCurMedalCache()
  }

  async function takeOffMedal() {
    let csrfToken = getCsrfToken()
    let data = new FormData()
    data.append('csrf_token', csrfToken)
    data.append('csrf', csrfToken)
    let rsp = (await apiClient.post('/xlive/web-room/v1/fansMedal/take_off', data)).data
    if (rsp.code !== 0) {
      throw rsp.message
    }
    refreshBilibiliCurMedalCache()
  }

  function getCsrfToken() {
    let match = document.cookie.match(/\bbili_jct=(.+?)(?:;|$)/)
    if (match === null) {
      return ''
    }
    return match[1]
  }

  function refreshBilibiliCurMedalCache() {
    let originalMedalButton = document.querySelector('.medal-section .fans-medal-item')
    if (originalMedalButton === null) {
      return
    }
    originalMedalButton.click()
    setTimeout(() => originalMedalButton.click(), 0)
  }

  main()
})();
