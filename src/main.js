import Vue from 'vue'
import App from './App'
import elementUI from 'element-ui'
import 'element-ui/lib/theme-chalk/index.css'

Vue.use(elementUI);
Vue.config.productionTip = false

new Vue({
  el: '#app',
  render: h => h(App)
})
