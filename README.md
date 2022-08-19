# threejs-map

## Project setup
```
npm install
```

### Compiles and hot-reloads for development
```
npm run serve
```

### Compiles and minifies for production
```
npm run build
```

### Lints and fixes files
```
npm run lint
```
没空维护这个项目了，这个球就先到这里吧，主要是发现使用球之后，需要考虑的情况太过复杂，一个人维护不过来，感觉要跳到GIS坑里面爬不出来了

代码也只是个雏形，注释很少（可以说是没有吧），也有很多地方是冗余的，可以说是垃圾代码，主要是想试试看自己能不能写出一个球来

不过里面倒是踏平了一些坑，球的主体逻辑是从Cesium移植过来的，踩过了一些移植的坑，比如84投影的瓦片重投影问题，瓦片层级切换时如何不产生黑块或者空白快，attribute压缩，当level>4(也可能是level>8，忘了，哈哈，1.83版本可能是大于4就不需要重投影了，自己慢慢看吧☺)时的性能优化问题，简单提一嘴，当层级比较高时，就不需要进行重投影了，每个瓦片就是一个标准的正方形的形状（其实不是，在Cesium中瓦片的mesh最终形状是一个无底的长方体），因此每一个瓦片的Geometry数据是一样的，不过目前的性能还是比不上Cesium，原因可能在于threejs创建的Program数量要比Cesium的多，暂时还不清楚是我自己的原因还是threejs的原因，哪位大神如果知道的话，还请赐教！

另外，鼠标操作也是抄的Cesium，核心的一点就是Control最终计算的矩阵能对的上threejs的Camera的矩阵就ok了

要用的话就拿去用吧，不过最后还是厚脸皮求个star！！！

引流：有问题可以去QQ群问，群号：173306525
