需要使用三个属性

1. 容器 div  layout="grid" 
2. 设置grid的每行的宽度和每列的高度

```
 grid_column_dsc_array="70,70,70" 
 grid_row_dsc_array="50,50,50"
```
注: 
https://docs.lvgl.io/master/layouts/grid.html#grid-descriptors
LV_GRID_CONTENT = 8090 自适应宽度
LV_GRID_FR(x) = 8091 + x 自适应宽度+边距

3. 容器下元素 使用 grid_cell
grid_cell是json格式

```
{ "row":{"align":"center", "pos":0, "span":1}, 
"col":{"align":"center", "pos":0, "span":1}}
```
grid_cell  span默认为 1， align默认为center 可以简写:
```
{ "row":{ "pos":0}, 
"col":{ "pos":0}}

```

完整例子如下

```
...... layout.xml
<div class="top" gridnav="true">
    <label class="txt" :text="title"  center="true"/>
    <div class="grid" :state="state"  grid_column_dsc_array="70,70,70" grid_row_dsc_array="50,50,50" layout="grid" >
        <button  v-for="item in list" class="btn" :grid_cell="item.cell" @click="show_msg(item.name)" >
            <label class="txt" :text="item.name" center="true" />
        </button>   
    </div>
</div>   

...... data.json
{
    "title":"hello world",
    "state":"true",
    "list":[
        {"name":"1", "cell":{ "row":{"align":"center", "pos":0, "span":1}, "col":{"align":"center", "pos":0, "span":1}}},
        {"name":"2", "cell":{ "row":{"align":"center", "pos":0, "span":1}, "col":{"align":"center", "pos":1, "span":1}}},        
        {"name":"3", "cell":{ "row":{"align":"center", "pos":0, "span":1}, "col":{"align":"center", "pos":2, "span":1}}},
        {"name":"4", "cell":{ "row":{"align":"center", "pos":1, "span":1}, "col":{"align":"center", "pos":0, "span":1}}},        
        {"name":"5", "cell":{ "row":{"align":"center", "pos":1, "span":1}, "col":{"align":"center", "pos":1, "span":1}}},
        {"name":"6", "cell":{ "row":{"align":"center", "pos":1, "span":1}, "col":{"align":"center", "pos":2, "span":1}}},        
        {"name":"7", "cell":{ "row":{"align":"center", "pos":2, "span":1}, "col":{"align":"center", "pos":0, "span":1}}},
        {"name":"8", "cell":{ "row":{"align":"center", "pos":2, "span":1}, "col":{"align":"center", "pos":1, "span":1}}},        
        {"name":"8", "cell":{ "row":{"align":"center", "pos":2, "span":1}, "col":{"align":"center", "pos":2, "span":1}}}
    ]
}
```
![图片](../../image/cddaad94-a300-40e8-a3cc-0509e6f16149.png)

gird_align 属性列表
| 属性值 | 描述 | lv对应值 |
|:-----|:----:|:----|
|start |  |LV_GRID_ALIGN_START|
|end|  |LV_GRID_ALIGN_END|
|center|  |LV_GRID_ALIGN_CENTER|
|space_evenly|  |LV_GRID_ALIGN_SPACE_EVENLY|
|space_around|  |LV_GRID_ALIGN_SPACE_AROUND|
|space_between|  |LV_FLEX_ALIGN_SPACE_BETWEEN|

