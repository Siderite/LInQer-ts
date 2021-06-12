@ECHO OFF
REM Delete Javascript files as we will generate them now
DEL docs\lib\LInQer.js
DEL docs\lib\LInQer.min.js

REM Requires npm install typescript -g
call tsc -p tsconfig.json

copy /B "legacy-start.js"+"build\main\lib\enumerable.js"+"legacy-end.js" "docs/lib/LInQer.js"

REM Requires npm install terser -g
call terser --compress --mangle -o docs\lib\LInQer.min.js -- docs\lib\LInQer.js

call npm run-script doc
xcopy /S /Y build\docs\ docs\