1. adb 安装

macos下安装
```brew install --cask android-platform-tools```

2. 安装app
模拟器运行目录下有./lfs目录，讲lfs目录的文件push 到/data/lfs目录下
```adb push ./lfs/* /data/lfs/```

3. 重启应用
应用在/data/guliteos_test
通过 adb shell 进入linux下

```
killall -9 guliteos_test
cd /data/
./guliteos_test

```

