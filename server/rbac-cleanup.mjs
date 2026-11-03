let p='server/services/rbac.service.ts';
let s=require('fs').readFileSync(p,'utf8');
s=s.split('\r\n').join('\n');
let lines=s.split('\n');
let start=lines.findIndex((l)=>l.includes('async requirePermission'));
if(start===-1){ process.stdout.write('NO requirePermission found\n'); process.exit(1); }
// keep clean requirePermission + requireAction, replace everything after hasPermission closing brace
let block=[
'  async requirePermission(userId: string, permission: string): Promise<void> {',
'    const ok = await this.hasPermission(userId, permission);',
'    if (!ok) {',
'      throw new ForbiddenError(`Permission required: ${permission}`);',
'    }',
'  }',
'',
'  async requireAction(userId: string, action: string): Promise<void> {',
'    const ok = await this.canUserDo(userId, action);',
'    if (!ok) {',
'      throw new ForbiddenError(`Action not permitted: ${action}`);',
'    }',
'  }',
].join('\n') + '\n';
// find end of hasPermission method
let hpEnd=lines.findIndex((l,i)=>i>=start && l.trim()==='  }');
if(hpEnd===-1){ process.stdout.write('no hasPermission end found\n'); process.exit(1); }
let after=lines.slice(hpEnd+1).join('\n');
// drop any trailing dup of these two methods
let rest=after.split('\n');
let keepUntil=rest.length;
let firstRestImportant=rest.findIndex((l)=>l.includes('requirePermission') || l.includes('requireAction') || l.includes('export'));
if(firstRestImportant>=0){ keepUntil=firstRestImportant; }
let final=lines.slice(0,hpEnd+1).join('\n')+'\n'+block+(keepUntil<rest.length?'\n'+rest.slice(keepUntil).join('\n'):'\n');
final=final.split('\n').join('\r\n');
require('fs').writeFileSync(p,final);
let finalLines=final.split('\r\n');
process.stdout.write('rewrote rbac after hasPermission. lines now='+finalLines.length+'\ntail=\n'+finalLines.slice(-12).join('\r\n')+'\n');
