dom的定位分为：绝对定位、相对定位、相对定位加偏移。

## 绝对定位
使用pos属性指定当前dom在父dom中的位置。

```
# 该div定位在全屏幕x=100，y=200的位置
<div pos="100 200"><div>
```


## 相对定位
使用align属性指定当前dom针对父dom的位置。

```
# 该div定位在父容器的正中间
<div align="center"></div>
```

align可取的属性值为：
| 属性值 | 描述 |
|:-----|:----|
| top_left|顶部左侧|
| top_mid|顶部中央|
| top_right|顶部右侧|
| bottom_left|底部左侧|
| bottom_mid|底部中央|
| bottom_right|底部右侧|
| left_mid|左侧中央|
| right_mid|右侧中央|
| center|居中|
| OUT_TOP_LEFT | 见下图 |
| OUT_TOP_MID | 见下图 |
| OUT_TOP_RIGHT| 见下图 |
| OUT_BOTTOM_LEFT | 见下图 |
| OUT_BOTTOM_MID | 见下图 |
| OUT_BOTTOM_RIGHT | 见下图 |
| OUT_LEFT_TOP | 见下图 |
| OUT_LEFT_MID |  见下图 |
| OUT_LEFT_BOTTOM | 见下图 |
| OUT_RIGHT_TOP| 见下图 |
| OUT_RIGHT_MID| 见下图 |
| OUT_RIGHT_BOTTOM| 见下图 |

![图片](../../../image/2b914fc6-87eb-4c64-972a-9fd06089c222.png)

## 相对定位再加偏移
使用align_pos 属性在相对定位后再加偏移。
* 可以使用负数来当偏移量
* x、y两个偏移量必须均给值，不偏移给0，不能不给

```
# 相对定位在父容器顶部，距离顶部10个像素
<div align_pos="top_mid 10 0"></div>

# 相对定位在父容器右下角，距离底部10个像素，右侧20个像素
<div align_pos="bottom_right -20 -10"></div>
```


## 属性值
align_pos、pos属性只能设置像素值。

```
<img src="1.png" pos="10 10"></img>

<img src="1.png" align_pos="top_mid 10 10"></img>
```