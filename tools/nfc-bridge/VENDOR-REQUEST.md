# SDK request for the T6-AU reader

Send this to the seller, or to the vendor directly:

- WeChat: 13823276735 (Mr. Dai) or 13480798831
- Email: dzh0809@163.com

The Chinese version is what to send; the English is for your reference.

---

## 中文（发送这一段）

您好，我们购买了贵司的 T6 系列 13.56MHz USB 读写器，型号 **T6-AU-10-03**
（批号 M2507100005-CJ，固件显示 "T6-CompPRO-AU-10-00 V1."，USB VID/PID 0483:4C43）。
我们需要在自己的 Windows 软件中读取 M1 卡（MF-02A）的卡号，请提供以下资料：

1. T6 系列二次开发包：动态库（DLL，如有请同时提供 32 位和 64 位版本）、头文件或函数声明。
2. 《T6系列用户手册》及开发包说明文档。
3. Demo 程序及源代码（C# 或 VC 优先）。
4. 如有，USB-HID 通信协议文档（读卡号、蜂鸣器等命令的数据包格式）。
5. 这款 T6-AU 是否可以设置为免驱键盘输出模式（刷卡自动输出卡号）？如果可以，请告诉我们设置方法。

另外请确认：读取卡号需要先调用哪些函数（例如打开设备、寻卡、防冲突、选卡），以及如何让读卡器蜂鸣。

谢谢！

---

## English (for reference)

Hello, we bought your T6 series 13.56 MHz USB reader/writer, model
**T6-AU-10-03** (batch M2507100005-CJ, firmware "T6-CompPRO-AU-10-00 V1.",
USB VID/PID 0483:4C43). We need to read the card number of M1 (MF-02A) cards
from our own Windows software. Please send:

1. The T6 SDK: the DLL (both 32-bit and 64-bit if available) and its header
   file or function declarations.
2. The T6 series user manual and SDK documentation.
3. The demo program and its source code (C# or VC preferred).
4. If available, the USB-HID protocol document (packet format for reading the
   card number, beeping, etc.).
5. Can this T6-AU be set to driver-free keyboard output mode (automatically
   types the card number when a card is tapped)? If so, how?

Please also confirm which functions must be called to read a card number
(e.g. open device, request, anticollision, select) and how to make the
reader beep.

Thank you!

---

## When the files arrive

Put the SDK folder anywhere (not inside this repo) and run:

```powershell
cd tools\nfc-bridge; npm run inspect-dll -- "C:\path\to\the\vendor.dll"
```

That only reads the file — it lists the functions the DLL exports and whether
it is 32-bit or 64-bit, without loading or running any of it. With that list
and the manual, the bridge can be wired to call the vendor's functions.
