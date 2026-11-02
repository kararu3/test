!macro customInit
  ; إغلاق أي عملية قديمة تعمل في الخلفية قبل بدء التثبيت
  ExecWait 'taskkill /F /IM "Examy PRO.exe"'
  ExecWait 'taskkill /F /IM "exambuilder-pro.exe"'
  ExecWait 'taskkill /F /IM electron.exe'
!macroend