webpackJsonp([0],{"Fsg/":function(t,e){},NHnr:function(t,e,n){"use strict";Object.defineProperty(e,"__esModule",{value:!0});var o=n("lRwf"),i=n.n(o),s={props:{top:Number,left:Number},data:function(){return{show:{type:Boolean,default:!1}}},computed:{contentContainerLeft:function(){return this.top&&this.left&&this.$refs.content&&this.$refs.screen?Math.min(this.left,this.$refs.screen.clientWidth-this.$refs.content.clientWidth)+"px":"0px"},contentContainerTop:function(){return this.top&&this.left&&this.$refs.content&&this.$refs.screen?Math.min(this.top,this.$refs.screen.clientHeight-this.$refs.content.clientHeight)+"px":"0px"},contentContainerWidth:function(){return this.top&&this.left&&this.$refs.content&&this.$refs.screen?"auto":"100%"},contentContainerHeight:function(){return this.top&&this.left&&this.$refs.content&&this.$refs.screen?"auto":"100%"}}},r={render:function(){var t=this,e=t.$createElement,n=t._self._c||e;return n("div",[n("div",{staticClass:"v-modal-container"},[n("div",{ref:"screen",staticClass:"v-modal-screen",on:{click:function(e){t.$emit("close-modal")}}}),t._v(" "),n("div",{staticClass:"v-modal-content-container",style:{top:t.contentContainerTop,left:t.contentContainerLeft,width:t.contentContainerWidth,height:t.contentContainerHeight}},[n("div",{ref:"content",staticClass:"v-modal-content"},[n("div",{staticClass:"v-modal-header"},[t._t("v-modal-header")],2),t._v(" "),n("div",{staticClass:"v-modal-body"},[t._t("v-modal-body")],2),t._v(" "),n("div",{staticClass:"v-modal-footer"},[t._t("v-modal-footer")],2)])])])])},staticRenderFns:[]};var a=n("VU/8")(s,r,!1,function(t){n("Wabx")},"data-v-bd50cc66",null).exports,c=n("u0wG"),l={props:{placeholder:{type:String,default:"Start typing to search ..."},rawarray:{type:Array,default:function(){return[]}}},data:function(){return{showSuggestions:!1,typedText:""}},methods:{filteredArray:function(){var t=this;return this.rawarray.filter(function(e){return new RegExp(t.typedText,"gi").test(e)})},selectSlice:function(t){this.$emit("selectslice",t)},hitEnter:function(){if("Enter"===event.key){var t=this.filteredArray();if(t.length>0){this.selectSlice(t[0]),this.typedText="";var e=document.querySelector(":focus");e&&e.blur()}}}}},u={render:function(){var t=this,e=t.$createElement,n=t._self._c||e;return n("div",{staticClass:"autocomplete-container"},[n("input",{directives:[{name:"model",rawName:"v-model",value:t.typedText,expression:"typedText"}],attrs:{type:"text",placeholder:t.placeholder},domProps:{value:t.typedText},on:{keydown:function(e){return e.stopPropagation(),t.hitEnter(e)},focus:function(e){t.showSuggestions=!0},blur:function(e){t.showSuggestions=!1},input:function(e){e.target.composing||(t.typedText=e.target.value)}}}),t._v(" "),n("transition",{attrs:{name:"fade"}},[t.showSuggestions?n("div",{staticClass:"autocomplete-suggestion-container"},t._l(t.filteredArray(),function(e,o){return n("div",{key:o,staticClass:"autocomplete-suggestions",on:{mousedown:function(n){t.selectSlice(e)}}},[t._v("\n        "+t._s(e)+"\n      ")])})):t._e()])],1)},staticRenderFns:[]};var p=n("VU/8")(l,u,!1,function(t){n("lO33")},"data-v-15b7bf91",null).exports,f={props:{value:{type:String,default:"default value"},copyable:{type:Boolean,default:!0}},data:function(){return{copiedFlag:!1,timeoutRef:0,copyBtnShown:!1}},methods:{copyToClipBoard:function(){var t=this;this.copiedFlag=!0,this.timeoutRef&&clearTimeout(this.timeoutRef),setTimeout(function(){t.copiedFlag=!1,t.timeoutRef=0},2e3),this.$refs.inputEl.focus(),this.$refs.inputEl.select(),document.execCommand("copy",!1)},methodGetCopyText:function(){return this.copiedFlag?"Copied!":"Copy"}}},d={render:function(){var t=this,e=t.$createElement,n=t._self._c||e;return n("div",{staticClass:"copy-field-root"},[n("input",{ref:"inputEl",attrs:{readonly:"",type:"text"},domProps:{value:t.value}}),t._v(" "),n("div",{attrs:{hidden:!t.copyable},on:{click:function(e){return e.stopPropagation(),t.copyToClipBoard(e)}}},[t._v(t._s(t.methodGetCopyText())+"\n  ")])])},staticRenderFns:[]};var v=n("VU/8")(f,d,!1,function(t){n("Fsg/")},null,null).exports;i.a.config.productionTip=!1,i.a.component("vue-modal",a),i.a.component("vue-pill",c.default),i.a.component("vue-autocomplete",p),i.a.component("vue-copyfield",v)},RQup:function(t,e){t.exports={props:{name:{type:String,default:"Untitled"},closable:{type:Boolean,default:!0}}}},VPzb:function(t,e,n){"use strict";var o={render:function(){var t=this,e=t.$createElement,n=t._self._c||e;return n("div",{staticClass:"v-pill-container",on:{click:function(e){e.stopPropagation(),e.preventDefault(),t.$emit("select-pill")}}},[n("span",{staticClass:"v-pill-name"},[t._v(t._s(t.name))]),t._v(" "),t.closable?n("span",{staticClass:"v-pill-remove",on:{click:function(e){e.stopPropagation(),e.preventDefault(),t.$emit("remove-pill")}}},[t._v("×")]):t._e()])},staticRenderFns:[]};e.a=o},Wabx:function(t,e){},lO33:function(t,e){},lRwf:function(t,e){t.exports=Vue},n4BF:function(t,e){},u0wG:function(t,e,n){"use strict";var o=n("RQup"),i=n.n(o),s=n("VPzb");var r=function(t){n("n4BF")},a=n("VU/8")(i.a,s.a,!1,r,"data-v-2d829cc6",null);e.default=a.exports}},["NHnr"]);
//# sourceMappingURL=app.js.map