<template>
  <div id="spliter" :class="resizeClass" @click="toggleLeft"></div>
</template>

<script>
import dataCenter from "../dataCenter";

export default {
  computed: {
    resizeClass() {
      return dataCenter.layout.left.display ? "resize-left" : "resize-right";
    },
  },
  methods: {
    toggleLeft() {
      if (dataCenter.layout.left.display) {
        dataCenter.layout.left.display = undefined;
      } else {
        dataCenter.layout.left.display = "none";
      }
    },
  },
};
</script>

<style>
#spliter {
  width: 10px;
  background: #f0f0;
}
#spliter:hover{
  background: #aaa;
}
.resize-left {
  cursor: e-resize;
}
.resize-right {
  cursor: w-resize;
}
</style>