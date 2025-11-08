**目标：**
       降低gif的cpu消耗

**方案：**
       将gif的每一帧变成原始的数据，避免显示每一帧时做解码操作。

**步骤：**
1. 确保gif的帧率改到25

2. 使用gif转bgf的格式
引擎的工具（tools）目录下 gifdec_tool 命令
```
gifdec_tool test.gif test.bgf
```
3. 代码
```
    <gif  src="file:/lfs/sun.bgf" />          
```


**说明：**
bgf文件会很大，会占文件系统的空间，不会加载到内存