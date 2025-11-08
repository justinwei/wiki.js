
https://docs.lvgl.io/master/layouts/flex.html
flex 布局完全依赖 css实现，例如：
```
...... layout.xml
<div class="top">
       <button > <label text="1" /> </button>
       <button > <label text="2" /> </button>
       <button > <label text="3" /> </button>
</div>

...... style.css

.top{
    width: 100%;
    height: 100%;    
    display: flex;
    flex-flow: row wrap;  
    align-items:center;       
}


```


*display
详细看以下链接
https://docs.lvgl.io/master/layouts/flex.html

| 属性值 | 描述 | lv对应值 |
|:-----|:----:|:----|
|grid |  |LV_LAYOUT_GRID|
|flex |  |LV_LAYOUT_FLEX|


*flex-flow:

| 属性值 | 描述 | lv对应值 |
|:-----|:----:|:----|
|row nowrap |  |LV_FLEX_FLOW_ROW|
|column nowrap |  |LV_FLEX_FLOW_COLUMN|
|row wrap |  |LV_FLEX_FLOW_ROW_WRAP|
|column wrap |  |LV_FLEX_FLOW_COLUMN_WRAP|
|row-reverse nowrap |  |LV_FLEX_FLOW_ROW_REVERSE|
|column-reverse nowrap |  |LV_FLEX_FLOW_COLUMN_REVERSE|
|row-reverse wrap|  |LV_FLEX_FLOW_ROW_WRAP_REVERSE|
|column-reverse wrap |  |LV_FLEX_FLOW_COLUMN_WRAP_REVERSE|
|row nowrap |  |LV_FLEX_FLOW_ROW|

*flext_align

| 属性值 | 描述 | lv对应值 |
|:-----|:----:|:----|
| flex_main_place / <br>justify-content |  | FLEX_ALIGN | ||
| cross_place /<br>align-items|  | FLEX_ALIGN | ||
|flex_track_place /<br>align-content  |  | FLEX_ALIGN | ||
| flex_grow/<br>flex-flow |  | FLEX_ALIGN | ||

FLEX_ALIGN详细属性值如下：

| 属性值 | 描述 | lv对应值 |
|:-----|:----:|:----|
|flex-start |  |LV_FLEX_ALIGN_START|
|flex-end |  |LV_FLEX_ALIGN_END|
|center |  |LV_FLEX_ALIGN_CENTER|
|stretch |  |LV_FLEX_ALIGN_SPACE_EVENLY|
|space_around |  |LV_FLEX_ALIGN_SPACE_AROUND|
|space_between |  |LV_FLEX_ALIGN_SPACE_BETWEEN|