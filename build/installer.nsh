!macro customInit
  ; التحقق مما إذا كان البرنامج مثبتاً مسبقاً في سجلات الويندوز
  ReadRegStr $R0 HKLM "Software\Microsoft\Windows\CurrentVersion\Uninstall\${APP_GUID}" "UninstallString"
  StrCmp $R0 "" checkCurrentUser 0

  checkCurrentUser:
  ReadRegStr $R0 HKCU "Software\Microsoft\Windows\CurrentVersion\Uninstall\${APP_GUID}" "UninstallString"
  StrCmp $R0 "" notInstalled 0

  ; في حال تم العثور على البرنامج مثبت مسبقاً، تظهر رسالة التحديث للمستخدم
  MessageBox MB_YESNO|MB_ICONQUESTION "تم العثور على إصدار سابق من Examy PRO مثبت على هذا الجهاز.$\r$\n$\r$\nهل ترغب في تحديث وترقية البرنامج إلى هذا الإصدار الجديد الآن؟" IDYES proceedUpdate IDNO cancelInstall

  proceedUpdate:
    ; المتابعة في التحديث وترقية الملفات
    Goto notInstalled

  cancelInstall:
    ; إلغاء التثبيت إذا اختار المستخدم "لا"
    Quit

  notInstalled:
!macroend