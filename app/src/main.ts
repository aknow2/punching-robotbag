import './style.css'
import runApp from './app.ts'

document.querySelector<HTMLDivElement>('#app')!.innerHTML = `
  <canvas id="main-canvas"></canvas>
`

runApp(document.querySelector<HTMLCanvasElement>('#main-canvas')!).then(() => {})
