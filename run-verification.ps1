# Background verification helper (run via Start-Process -File, no new window)
cd 'c:\Users\manue\Desktop\twin_cakery\erp\server'
npm i -D typescript@5.8.3 --no-audit --no-fund > install-typescript.log 2>&1
cd 'c:\Users\manue\Desktop\twin_cakery\erp\erp-interface-design'
node_modules\.bin\tsc --noEmit --pretty false > tsc-interface.log 2>&1
echo INTERFACE_EXIT=$? >> tsc-interface.log
cd 'c:\Users\manue\Desktop\twin_cakery\erp\sweet-moments-cakery'
npm run typecheck > tsc-sweet.log 2>&1
echo SWEET_EXIT=$? >> tsc-sweet.log
cd 'c:\Users\manue\Desktop\twin_cakery\erp\server'
npm run build > build-server.log 2>&1
echo SERVER_BUILD_EXIT=$? >> build-server.log
cd 'c:\Users\manue\Desktop\twin_cakery\erp\erp-interface-design'
npm run build > build-erp.log 2>&1
echo ERP_BUILD_EXIT=$? >> build-erp.log
