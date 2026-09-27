# 锦鲤池独立网页版

这是从 Wallpaper Engine 项目中剥离出的独立版本，不依赖 Wallpaper Engine、Lively Wallpaper、Tauri 或本地 HTTP 服务。

## 直接浏览

双击 index.html 即可运行。

## 编辑项目

- 功能源码：src/
- 主题与形状：theme.js、koishape.js、watergl.js
- 样式：style.css
- 图片资源：assets/

修改 src/ 后，双击 构建并预览.cmd。脚本会重新生成 app.bundle.js 并打开 index.html。

也可以在终端执行：node build-standalone.cjs

app.bundle.js 是自动生成文件，不需要手工修改。

## 鱼外观调试面板

页面右上角提供“鱼外观调试”面板，可实时修改品种、鱼身比例、鱼鳍、眼睛、颜色、斑纹、纯黑描边粗细、鳞片和金属光泽。按 D 可以快速显示或隐藏面板，“复制参数”会输出当前配置 JSON。

“平面运动”区域可以调整游动速度、转弯半径、转向响应和巡游弯曲度，并实时显示平均游速、转向率、转弯半径和当前主要行为。
