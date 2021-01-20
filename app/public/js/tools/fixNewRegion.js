/*global Microdraw*/
/*global paper*/

var ToolFixNewRegion = {
  fixNewRegion: (function(){
    let fixed = false

    const updateSectionNameCb = []
    const loginCB = []
    let filteredList = []

    const cvtMetadataToDisplayName = (metadata) => `${metadata.brainID} S${metadata.sectionID}`

    Microdraw.loadNextImage = function () {
      const currentImageIdx = Microdraw.imageOrder.indexOf(Microdraw.currentImage)
      const { id: currentImageHash } = Microdraw._otherProperties[currentImageIdx]
      const nextImageIdx = Microdraw._otherProperties.findIndex(({ id }, idx) => idx > currentImageIdx && id !== currentImageHash)

      Microdraw.updateSliderValue( nextImageIdx >= 0 ? nextImageIdx : 0 )

      const nextImageObj = Microdraw.imageOrder[nextImageIdx >= 0 ? nextImageIdx : 0]
      Microdraw.loadImage( nextImageObj )
    }

    Microdraw.sliderOnChange = function (index) {
      if (Number(index) === NaN) {
        console.warn(`slider On Change not a number`, index)
        return
      }

      const newItemToLoad = filteredList[Number(index)] || filteredList[0]
      const nextItemIdx = Microdraw._otherProperties.findIndex(({ id, imageIndex }) => newItemToLoad.id === id && newItemToLoad.imageIndex === imageIndex)

      const newImageObj = Microdraw.imageOrder[nextItemIdx]
      Microdraw.loadImage(newImageObj)
    }

    Microdraw.initSlider = function () {
      const slider = document.getElementById('slider')
      if (!slider) {
        console.warn(`slider cannot be found`)
        return
      }

      filteredList = Microdraw._otherProperties.reduce((acc, curr) => {
        const exists = acc.find(({ id }) => id === curr.id )
        return exists ? acc : acc.concat(curr)
      }, [])

      slider.setAttribute('min', 0)
      slider.setAttribute('max', filteredList.length - 1)
      const handleChangeEv = ev => Microdraw.sliderOnChange(ev.target.value)
      slider.addEventListener('input', handleChangeEv)
    }

    const appendPliSlider = function () {
      const container = document.createElement('div')
      container.style.display = `block`
      container.id = `pliSliderContainer`
      container.innerHTML = `
      <div
        v-show="!!steps"
        class="text-black">
        <label for="pliSlider">Slice: {{ sliderIdx }}</label>
        <br />
        <input
          min="0"
          step="1"
          :max="steps"
          :disabled="!steps"
          :value="sliderIdx"
          @input="updateValue"
          name="pliSlider"
          id="pliSlider"
          type="range" />
      </div>
      `

      const originalSlider = document.getElementById('slider')
      originalSlider.parentElement.appendChild(container)
      const vueCompo = new Vue({
        el: '#pliSliderContainer',
        props: {
          steps: {
            type: Number,
            default: null
          }
        },
        data: function () {
          return {
            sliderIdx: 0
          }
        },
        watch: {
          steps: function (val) {
            if (!val) this.sliderIdx = 0
          }
        },
        methods: {
          updateValue: function (ev) {
            this.sliderIdx = Number(ev.target.value)
            this.$emit('updateSlider', this.sliderIdx)
          }
        }
      })

      vueCompo.$on('updateSlider', val => {
        const currentImageIdx = Microdraw.imageOrder.indexOf(Microdraw.currentImage)
        const { id: imageHash } = Microdraw._otherProperties[currentImageIdx]
        const nextIndex = Microdraw._otherProperties.findIndex(({ id, imageIndex }) => id === imageHash && val === imageIndex)
        const firstIndex = Microdraw._otherProperties.findIndex(({ id, imageIndex }) => id === imageHash && 0 === imageIndex)

        const nextImageObj = Microdraw.imageOrder[nextIndex >= 0 ? nextIndex : firstIndex]
        Microdraw.loadImage( nextImageObj )
      })

      updateSectionNameCb.push(() => {
        
        const currentImageIdx = Microdraw.imageOrder.indexOf(Microdraw.currentImage)
        const { imageIndex = null, id } = Microdraw._otherProperties[currentImageIdx]
        if (imageIndex === null) {
          vueCompo.$props.steps = null
          return
        }
        let idx = 0
        while (Microdraw._otherProperties[currentImageIdx + idx] && Microdraw._otherProperties[currentImageIdx + idx].id === id ) {
          idx ++
        }
        vueCompo.$props.steps = Microdraw._otherProperties[currentImageIdx + idx - 1].imageIndex
      })
    }

    Microdraw.updateSectionName = function(){
      updateSectionNameCb.forEach(cb=>cb())
      // $('title').text("MicroDraw|" + filename + "|" + me.currentImage);
    }

    let queryNewName = () => Promise.reject('patch have not yet completed')

    const loadVue = function(){
      return new Promise((resolve,reject)=>{

        const vueScriptSrc = `https://cdn.jsdelivr.net/npm/vue/dist/vue.js`
        const vueScriptEl = document.createElement('script')
        vueScriptEl.onload = ()=>resolve()
        vueScriptEl.onerror = (e)=>reject(e)
        vueScriptEl.src = vueScriptSrc
        document.head.appendChild(vueScriptEl)
      })
    }

    const loadVueComponents = function () {

      const cssEl = document.createElement('link')
      cssEl.href = `js/tools/vue-components/css/app.css`
      cssEl.type = 'text/css'
      cssEl.rel = 'stylesheet'
      document.head.appendChild(cssEl)

      const jsElManifest = document.createElement('script')
      jsElManifest.src = `js/tools/vue-components/js/manifest.js`

      const jsElVendor = document.createElement('script')
      jsElVendor.src = `js/tools/vue-components/js/vendor.js`

      const jsElApp = document.createElement('script')
      jsElApp.src = `js/tools/vue-components/js/app.js`

      const cssExtra = document.createElement('style')
      cssExtra.innerHTML = `
      .fade-enter-active, .fade-leave-active {
        transition: opacity .5s;
      }
      .fade-enter, .fade-leave-to /* .fade-leave-active below version 2.1.8 */ {
        opacity: 0;
      }`
      document.head.appendChild(cssExtra)

      const attachScript = (scriptElement) => new Promise((resolve, reject) => {
        scriptElement.onload = () => resolve()
        scriptElement.onerror = (error) => reject(error)
        document.head.appendChild(scriptElement)
      })
      
      return attachScript(jsElManifest)
        .then(()=>attachScript(jsElVendor))
        .then(()=>attachScript(jsElApp))
    }

    const patchNewRegionInput = function () {

      /* additional styles required */
      const extraStyle = document.createElement('style')
      extraStyle.innerHTML = `#newRegionForm
      {
        margin : 0.2em 0.5em;
        padding-top : 0.5em;
        padding-bottom : 0.5em;
      }

      .modal-body
      {
        background-color : rgba(255,255,255,0.8);
        padding: 1em;
        border-radius : 5px;
        box-shadow: 0 5px 10px -3px rgba(0,0,0,0.3);
      }

      .modal-body *
      {
        color:black;
      }
  
      .pill
      {
        box-shadow: 0 2px 5px -1px rgba(0,0,0,0.7);
      }

      .pill *
      {
        color:black;
      }

      #newRegionForm input[type="text"]
      {
        color:black;
        padding : 0.2em;
      }`
      document.head.appendChild(extraStyle)

      /* create and append root element */
      const modalEl = document.createElement('div')
      modalEl.setAttribute('id','v2-regionname-input-modal')
      modalEl.setAttribute('style','z-index:97;pointer-events:none;position:absolute; width:100%; height:100%;left:0;top:0;')
      modalEl.innerHTML = `
      <transition name = "fade" @after-enter = "afterEnter">
        <vue-modal style = "pointer-events:all" @close-modal = "visible = false" :left = "left" :top = "top" v-show = "visible">
          <template slot = "v-modal-body">
            <div class = "modal-body">
              <form id = "newRegionForm" @submit.stop.prevent = "formSubmit">
                <input ref = "newRegionTextInput" v-model="newRegionName" placeholder = "add new region label" type = "text">
                <input hidden type = "submit">
              </form>
              <transition-group name = "fade" tag = "span">
                <vue-pill 
                  class = "pill"
                  v-on:select-pill = "selectRegion(activeRegionName)" 
                  v-on:remove-pill = "removeRegion(activeRegionName)" 
                  v-bind:name = "activeRegionName" 
                  v-for = " (activeRegionName,index) in presetRegionNames ">
                </v-pill>
              </transition-group>
              <div>{{ error }}</div>
            </div>
          </template>
        </vue-modal>
      </transition>`
      document.body.appendChild(modalEl)

      /* init vue app */
      const regionInputModal = new Vue({
        el : '#v2-regionname-input-modal',
        data : {
          newRegionName : '',
          presetRegionNames : [],
          left : null,
          top : null,
          visible : false,
          error: null
        },
        methods : {
          afterEnter : function () {
            this.$refs.newRegionTextInput.focus()
          },
          catchError: function (e) {
            switch(e.message){
              case '401':
                this.error = 'You must sign in first'
              break;
              default:
                this.error = 'Server error occurred.'
              break;
            }
          },
          refreshRegion : function(){
            return fetch('/user/presetRegionNames',{
              credentials : 'same-origin',
            })
              .then(res=>{
                if (res.status === 200) {
                  return res.json()
                } else if (res.status === 401){
                  throw new Error('401')
                } else {
                  console.error('Other error', res)
                  throw new Error('500')
                }
              })
              .then((presetRegionNames)=>{
                this.error = null
                if (presetRegionNames)
                  this.presetRegionNames = presetRegionNames
              })
              .catch(this.catchError)
          },
          updateRegions  :function(regions){
            return fetch('/user/presetRegionNames',{
              method : 'PUT',
              headers : {
                'Content-type':'application/json'
              },
              credentials : 'same-origin',
              body : JSON.stringify({ 
                presetRegionNames : regions 
              })
            }).then(()=>
                this.refreshRegion())
          },
          
          /* modify user setting */
          removeRegion : function(name){
            this.updateRegions( this.presetRegionNames.filter(n=>n!==name) )
              .catch(this.catchError)
          },
          selectRegion : function(name){
            this.$emit('selected-region-name',name)
          },
          formSubmit : function(ev){
            this.updateRegions( this.presetRegionNames.concat( this.newRegionName ) )
              .then(()=>{
                this.newRegionName = ``
                this.$forceUpdate()
              })
              .catch(this.catchError)
          }
        },
        mounted() {
          this.refreshRegion()
        },
      })

      loginCB.push(() => regionInputModal.refreshRegion())

      /* patch microdraw functionalities */
      queryNewName = ( oldname ,ev ) => new Promise((resolve,reject)=>{
        regionInputModal.top = ev.clientY 
        regionInputModal.left = ev.clientX
        regionInputModal.visible = true

        regionInputModal.$on('selected-region-name',(name)=>{
          regionInputModal.$off()
          regionInputModal.visible = false
          resolve(name)
        })

        regionInputModal.$on('close-modal',()=>{
          regionInputModal.$off()
          reject('no new name chosen')
        })
      })

      Microdraw.doublePressOnRegion = function(event){
          
        if( Microdraw.debug ) console.log("> doublePressOnRegion extended by fixNewRegion.js");

        event.stopPropagation();
        event.preventDefault();

        if( event.clientX > 20 ) {
          if( event.clientX > 50 ) {
            if( Microdraw.config.drawingEnabled ) {
              let id = this.id
              queryNewName(  Microdraw.findRegionByUID(id).name, event )
                .then((value)=>{
                  Microdraw.changeRegionName( Microdraw.findRegionByUID(id), value);
                })
                .catch((error)=>{
                  /* should not be any errors */
                  console.log(error)
                })
            }   
          }
          else {
            var reg =  Microdraw.findRegionByUID(this.id);
            if( reg.path.fillColor != null ) {
              if( reg ) {
                Microdraw.selectRegion(reg);
              }
              Microdraw.annotationStyle(reg);
            }
          }
        }
        else {
            var reg =  Microdraw.findRegionByUID(this.id);
            Microdraw.toggleRegion(reg);
        }
      }
    }

    const patchUpdateSectionName = function () {

      const extraStyle = document.createElement('style')
      extraStyle.innerHTML = `#fzj-slice-navigator
        {
          width : 100px;
          margin-right:-15px;
          margin-left:-15px;
          height: 37px;
          cursor:default;
          display:inline-block;
          position:relative;
          vertical-align:middle;
        }
        #fzj-slice-navigator-inner-container
        {
          text-align:left;
          position : absolute;
          left: 0px;
          top: 0px;
        }
        #fzj-slice-navigator input[type="text"]
        {
          color:black;
          width: 65px;
          font-size:0.8em;
          margin-top:10px;
        }
        
        .autocomplete-suggestions
        {
          color:black;
          padding:0.1em 0.3em;
          transition: all 200ms;
          display: none;
          white-space:nowrap;
          background-color:rgba(240,240,240,0.8);
        }
        
        .autocomplete-suggestions:hover
        {
          background-color:rgba(200,200,200,0.8);
        }
        
        #fzj-slice-navigator:focus-within .autocomplete-suggestions
        {
          display: inline-block;
        }
        
        #sectionName
        {
          display:none;
        }`

      document.head.appendChild(extraStyle)

      const autocompleteEl = document.createElement('div')
      autocompleteEl.setAttribute('id','fzj-slice-navigator')
      autocompleteEl.innerHTML = `<vue-autocomplete @focus = "refresh" @selectslice = "selectSlice" :placeholder = "placeholder" :rawarray = "rawarray" />`
      const oldInput = document.getElementById('sectionName')
      oldInput.parentNode.insertBefore(autocompleteEl,oldInput)
      
      const sectionNameBrowser = new Vue({
        el : '#fzj-slice-navigator',
        data : {
          rawarray : [],
          placeholder : 'Search BrainID SectionID'
        },
        methods : {
          selectSlice : function(item){
            this.placeholder = item
            this.$emit('selectslice',item)
          },
          refresh : function(){
            if (!Microdraw._otherProperties) {
              this.rawarray = []
              return
            }

            /**
             * display 5 prior and 20 after of the current selected slice
             */
            const index = this.placeholder === 'Search BrainID SectionID'
              ? 0
              : Microdraw._otherProperties.findIndex(metadata => {
                return cvtMetadataToDisplayName(metadata) === this.placeholder
              })
            this.rawarray = Microdraw._otherProperties
              // remove none first duplicates
              .filter(({ id }, idx, arr) => !(arr.findIndex(({ id: _id }) => id === _id) < idx) )
              .map(metadata => cvtMetadataToDisplayName(metadata))
              .slice(
                Math.max(index - 5, 0)
              )
          }
        }
      })

      /* patch the emitted select slice event */
      sectionNameBrowser.$on('selectslice',(Bid_Sid)=>{
        const idx = Microdraw._otherProperties.findIndex(metadata => cvtMetadataToDisplayName(metadata) === Bid_Sid) 
        if( idx >= 0 && Microdraw.imageOrder[idx] ){
          Microdraw.updateSliderValue(idx)
          Microdraw.loadImage( Microdraw.imageOrder[idx] )
        }else{
          console.error('could not find the image to load')
        }
      })

      /* when section name is updated in other means (left/right arrow, on start), update placeholder appropriately */
      updateSectionNameCb.push(() => {
        
        /* still buggy. doesn't work on init */
        sectionNameBrowser.refresh()

        const idx = Microdraw.imageOrder.indexOf( Microdraw.currentImage )

        /**
         *  with the introduction of PLI images, actual slides is a reduced selection (grouped by imageIndex) 
         * So, up updateSecitonNameCb, find the first instance of imageHash (imageMetadata[idx].id), and set index 
         * 
        */
        const { id } = Microdraw._otherProperties[idx]
        const sliderVal = filteredList.findIndex(({ id: _id }) => _id === id)
        Microdraw.updateSliderValue(sliderVal)

        const sectionName = Microdraw._otherProperties
          ? Microdraw._otherProperties[ idx ]
            ? cvtMetadataToDisplayName(Microdraw._otherProperties[ idx ])
            : Microdraw.currentImage
          : Microdraw.currentImage

        sectionNameBrowser.placeholder = sectionName
      })

      /* patching original secitonNameOnEnter. this should no longer happen, since display:none */
      Microdraw.sectionNameOnEnter = function(event){
        
        if( event.keyCode === 13 ) { // enter key


          // var sectionNumber = $(this).val();
          // var index = me.findSectionNumber(sectionNumber);
          // if( index > -1 ) { // if section number exists
          //   me.updateSliderValue(index);
          //   me.loadImage(me.imageOrder[index]);
          // }
        }

        event.stopPropagation()
      }
    }

    const patchLocalLoginModal = function () {
      const parentEl = document.createElement('div')
      parentEl.setAttribute('id','v2-local-login-modal')
      parentEl.setAttribute('style','z-index:98;pointer-events:none;position:absolute; width:100%; height:100%;left:0;top:0;')
      parentEl.innerHTML = `
      <transition name = "fade" @after-enter = "afterEnter">
        <vue-modal style = "pointer-events:all" @close-modal = "visible = false" :left = "left" :top = "top" v-show = "visible && !loggedIn">
          <template slot = "v-modal-body">
            <div style = "margin-right: 10px" class = "modal-body">
              <form @keyup.stop @keydown.stop @keyup.enter = "login">
                <h3>Local Login</h3>
                <div class = "input-group">
                  <span class = "input-group-addon">username</span>
                  <input ref = "username" class = "form-control" placeholder = "username" type = "text" v-model = "username" />
                </div>
                <div class = "input-group">
                  <span class = "input-group-addon">password</span>
                  <input class = "form-control" placeholder = "******" type = "password" v-model = "password" />
                </div>
                <vue-pill 
                  class = "pill"
                  v-on:select-pill = "login" 
                  v-bind:closable = "false"
                  :style = "{color : forbidden ? 'red' : 'black'}"
                  name = "Login" >
                </v-pill>
              </form>

              <transition name = "fade">
                <small v-show = "forbidden" style = "font-size:75%;color:red;" >
                  Username and/or password incorrect
                </small>
              </transition>
              
            </div>
          </template>
        </vue-modal>
      </transition>`
      document.body.appendChild(parentEl)

      let a
      const loginModal = new Vue({
        el: '#v2-local-login-modal',
        data: {
          username: '',
          password: '',
          left: null,
          top: null,
          visible: false,
          forbidden: false,
          loggingIn: false,
          loggedIn: false
        },
        methods: {
          afterEnter: function () {
            this.$refs.username.focus()
          },
          login: function () {

            this.loggingIn = true

            const data = new URLSearchParams()
            data.set('username', this.username.toString())
            data.set('password', this.password.toString())
            
            fetch('/localLoginAjax', {
              method: 'POST',
              body: data,
              credentials: 'same-origin'
            })
              .then(res => {
                this.loggingIn = false
                if (res.status === 200){
                  return res.text()
                }else{
                  this.forbidden = true
                  setTimeout(() => this.forbidden = false, 1500)
                  return null
                }
              })
              .then(username => {
                if (username) {
                  a.innerHTML = username
                  a.setAttribute('href', `user/${username}`)
  
                  const logoutEl = document.createElement('a')
                  logoutEl.innerHTML = '(Log Out)'
                  logoutEl.setAttribute('href', 'logout')
                  a.parentNode.appendChild(logoutEl)
                  this.visible = false

                  loginCB.forEach(cb => cb())
                }
              })
              .catch(console.warn)
          }
        }
      })

      const loginContainer = document.getElementById('MyLogin')
      if (loginContainer) {
        window['loginmodal'] = loginModal
        loginContainer.addEventListener('click', (event) => {
          event.preventDefault()
          event.stopPropagation()
  
          loginModal.left = event.target.offsetLeft - 10
          loginModal.top = event.target.offsetHeight + 10
  
          loginModal.visible = true
        }, {
          capture: true
        })
      }
    }

    const patchTooltip = function () {
      const extraStyle = document.createElement('style')
      extraStyle.innerHTML = `
      #fzj-tooltip
      {
        position: absolute;
        bottom:10px;
        right: 50px;
        z-index:99;
      }

      #fzj-tooltip *
      {
        color:black;
      }
      
      #tooltip-activator
      {
        position:relative;
        font-size:200%;
        font-weight:900;
        color:rgba(128,128,128,0.5);
        background-color:rgba(0,0,0,0.1);
        border-radius:0.5em;
        width:1em;
        height:1em;
        text-align: center;
        cursor:default;
      
        transition : all 300ms;
      }
      
      #tooltip-activator:hover
      {
        background-color:rgba(0,0,0,0.3);
        color:rgba(255,255,255,0.8);
      }
      
      #tooltip-info
      {
        position: absolute;
        bottom:2em;
        right:0em;
        max-width:20em;
        overflow-x:hidden;
        background-color:rgba(255,255,255,0.8);
        padding : 10px;

        border : solid 1px rgba(128,128,128,0.2);
      }
      
      .tooltip-entry
      {
        width : 270px;
        display:flex;
      }

      .tooltip-entry-key
      {
        overflow:hidden;
        margin:auto;
        flex: 0 0 70px;
      }

      .tooltip-entry-value
      {
        flex: 0 0 200px;
        overflow:hidden;
      }
      `
      document.head.appendChild(extraStyle)

      const tooltipEl = document.createElement('div')
      tooltipEl.setAttribute('id','fzj-tooltip')
      tooltipEl.innerHTML = `
      <div @click.stop = "$emit('refresh');show = !show" id = "tooltip-activator">!</div>
      <transition name = "fade">
        <div class = "modal-body" v-show = "show" id = "tooltip-info">
          <div>{{ message }}</div>
          <div class = "tooltip-entry" v-for = "keyvalue in displayItems">
            <div class = "tooltip-entry-key">
              {{ keyvalue[0] }}
            </div>
            <vue-copyfield :value = "keyvalue[1]">
            </vue-copyfield>
          </div>
        </div>
      </transition>
      `
      const logo = document.getElementById('logo')
      logo.parentNode.insertBefore(tooltipEl,logo)

      const tooltip = new Vue({
        el: '#fzj-tooltip',
        props: {
          message: {
            type: String,
            default: ''
          },
          info: {
            type: Object,
            default: () => ({ nothing: 'to display' })
          }
        },
        data: {
          show: false
        },
        computed: {
          displayItems: function () {
            return this.info ? 
              Object.entries(this.info).map(entry => entry.map(item => item ? item.toString() : 'null')) :
              []
          }
        }
      })

      updateSectionNameCb.push(() => tooltip.$emit('refresh'))
      tooltip.$on('refresh',() => {
        tooltip.info = Object.assign({},Microdraw._otherProperties[ Microdraw.imageOrder.indexOf(Microdraw.currentImage) ])

        tooltip.message = `fetching all annotation data ...`

        const id = Microdraw._otherProperties[ Microdraw.imageOrder.indexOf(Microdraw.currentImage) ].id

        const processUserName = (user) => user.constructor === String
          ? user
          : 'anonymouse'

        fetch(`/all?image_hash=${id}`,{
          credentials : 'same-origin'
        })
          .then(res=>res.json())
          .then((data)=>{
            tooltip.message = [ 'Annotated By', 
              Array.from(data
                .map(item => processUserName(item.user))
                .reduce((acc,curr)=>
                  acc.get(curr) ?
                    acc.set( curr, acc.get(curr) + 1 ) :
                    acc.set( curr, 1 )
                  ,new Map()))
                .map(array=>{
                  return `${array[0]} (${array[1]})`
                })
                .join(' , ') ].join(' : ')
          })
          .catch(e=>{
            tooltip.message = [ 'Fetching all annotations error', JSON.stringify(e) ].join(' : ')
            console.log(e)
          })
      })
    }

    var tool = {

      /*
        * @function click
        * @desc Convert polygon path to bezier curve
        * @param {string} prevTool The previous tool to which the selection goes back
        * @returns {void}
        */
      click: function click(prevTool) {

        if(fixed){
          Microdraw.backToSelect();
          return
        }
        fixed = true;

        Microdraw.backToSelect();
      }
    }

    loadVue()
      .then(()=>loadVueComponents())
      .then(()=>{
        patchNewRegionInput()
        patchUpdateSectionName()
        patchTooltip()
        patchLocalLoginModal()
        appendPliSlider()
      })
      .then(() => {
        Microdraw.updateSectionName()
      })
      .catch(e=>{
        console.error('Loading VueJS Error!',e)
      })
    return tool
  }())
}