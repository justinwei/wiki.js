#### 目的：
    方便将t卡的代码自动同步到设备端

#### 方法:
    将需要复制到文件放在t卡的sync目录下
    建立一个sync.json的同步文件
    格式如下：

    ```
{
    "data":[
        {
            "local":"math_liteapp/code",
            "md5":"8f8c45a12d0a92b38aa98f8dcd866912"
        },
        {
            "local":"math_liteapp/assets/images",
            "md5":"933656b80ce718108c9a2169a314ccb6"
        },
        {
            "local":"math_liteapp/assets/audio",
            "md5":"ea50fd577676592f5f28d8682c22e3b0"
        },
        {
            "local":"font.bin",
            "md5":"409e9ae35fc7373cc06943e415f873a4"
        }
    ]
}
```    
PC端模拟工具会自动生成同步文件

    
