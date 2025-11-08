     <button focus_key=“true”> <label text="2" /> </button>
对于没有触摸的设备，需要用到键盘（上下左右键导航 按钮和输入框）

1. 只有按键，输入框，switch 等可以获得焦点的dom才可以支持导航
2. 需要导航的dom必须放在 layout flex或grid布局下

要实现该功能需要按以下步骤：
1. 的layout布局的div 增加gridnav=rollover

```
<div layout="grid" gridnav="rollover" >
```

2. 将button或text放在布局下

```
<div layout="grid" gridnav="rollover" >
     <button > <label text="1" /> </button>
     <button > <label text="2" /> </button>
     <button > <label text="3" /> </button>
     <button > <label text="4" /> </button>
</div>
```

3. 修改当前的选中焦点
使用 gridnav_focus 属性 设置成true

```
<div layout="grid" gridnav="rollover" >
     <button > <label text="1" /> </button>
     <button gridnav_focus=“true”> <label text="2" /> </button>
     <button > <label text="3" /> </button>
     <button > <label text="4" /> </button>
</div>
```

以上例子，将默认焦点放在button 2上

3. 如果一个页面有多个 布局之间需要按键导航
先监听key事件，然后设置group_focus属性来跳转
可以设置 group_focus 属性

