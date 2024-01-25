<template>
  <div class="main">
    <Operator/>
    <Logger/>
  </div>
</template>

<script>
import Logger from './components/Logger.vue'
import Operator from './components/Operator.vue'

export default {
  name: 'App',
  components: {
    Logger,
    Operator
  }
}
</script>

<style>
#app {
  font-family: Avenir, Helvetica, Arial, sans-serif;
  -webkit-font-smoothing: antialiased;
  -moz-osx-font-smoothing: grayscale;
  text-align: center;
  color: #2c3e50;
  height: 100%;
}
html,body{
  height: 100%;
  width: 100%;
  margin: 0;
  padding: 0;
}
.main{
  height: 100%;
  display: flex;
  padding: 10px;
  flex-direction: row;
}
.card-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
}
.panel{
  padding: 10px;
  background: #f0f0f0;
  border-radius: 4px;
}
.content{
  overflow-y: scroll;
}
</style>
