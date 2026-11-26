// Bake the four painted poses into transparent, looping WebP animations.
// Usage: node tools/render-kitten.cjs <2x2 transparent character atlas> [beret|cape]
const sharp = require(process.env.SHARP_MODULE || 'sharp');
const fs = require('node:fs');
const path = require('node:path');
const size = 352;
const frames = 32;
const output = path.resolve(__dirname, '../dist/kitten');
const outfit=process.argv[3]||'';
if(outfit&&!['beret','cape'].includes(outfit))throw Error('Unknown outfit');
const gaussian = (x, y, cx, cy, rx, ry) => Math.exp(-(((x-cx)/rx)**2 + ((y-cy)/ry)**2));

function offset(pose, x, y, phase) {
  const s = Math.sin(phase), pulse = (1 - Math.cos(phase)) / 2;
  const upper = Math.max(0, .96-y);
  if (pose === 'wave') {
    const paw = gaussian(x,y,.255,.39,.14,.23);
    return [paw*s*.074 + upper*s*.008, -paw*pulse*.034 + upper*pulse*.015];
  }
  if (pose === 'stretch') {
    const rump = gaussian(x,y,.25,.46,.28,.33);
    const head = gaussian(x,y,.69,.56,.27,.28);
    const tail = gaussian(x,y,.22,.17,.26,.25);
    return [tail*s*.05 + head*pulse*.034, -rump*pulse*.037 + head*pulse*.048];
  }
  if (pose === 'sleep') {
    const back = gaussian(x,y,.67,.48,.45,.34);
    return [back*pulse*.009, -back*pulse*.021];
  }
  const ear = gaussian(x,y,.69,.105,.105,.14);
  const twitch = Math.sin(2*phase) * Math.max(0, Math.cos(phase))**6;
  return [ear*twitch*.027 + upper*s*.006, -upper*pulse*.016];
}

async function bake(pose, index, atlas, side) {
  let tile=sharp(atlas).extract({left:(index%2)*side,top:Math.floor(index/2)*side,width:side,height:side});
  // The dressed reference already includes the original atlas's safety margin.
  tile=outfit?tile.resize(size,size):tile.resize(size-24,size-24).extend({top:12,bottom:12,left:12,right:12,background:'#00000000'});
  const {data}=await tile.ensureAlpha().raw().toBuffer({resolveWithObject:true});
  if(outfit==='beret'){
    // Clear the translucent paper haze outside the painted silhouette.
    for(let a=3;a<data.length;a+=4)data[a]=Math.round(data[a]*Math.min(1,Math.max(0,(data[a]-88)/132)));
  }
  const rendered = Buffer.alloc(size*size*4*frames);
  for (let f=0; f<frames; f++) {
    const phase = f/frames*Math.PI*2;
    for(let y=0;y<size;y++) for(let x=0;x<size;x++) {
      const [dx,dy] = offset(pose,x/size,y/size,phase);
      const u=x-dx*size, v=y-dy*size, i=Math.floor(u), j=Math.floor(v);
      if(i<0 || j<0 || i+1>=size || j+1>=size) continue;
      const fx=u-i, fy=v-j, pos=(j*size+i)*4, dst=((f*size+y)*size+x)*4;
      for(let c=0;c<4;c++) rendered[dst+c]=Math.round((1-fy)*((1-fx)*data[pos+c]+fx*data[pos+4+c])+fy*((1-fx)*data[pos+size*4+c]+fx*data[pos+size*4+4+c]));
    }
  }
  const delay = {idle:100,wave:32,stretch:66,sleep:110}[pose];
  const name=outfit?outfit+'-'+pose:pose;
  await sharp(rendered,{raw:{width:size,height:size*frames,pageHeight:size,channels:4}}).webp({quality:82,loop:0,delay:Array(frames).fill(delay)}).toFile(path.join(output,name+'.webp'));
  await sharp(data,{raw:{width:size,height:size,channels:4}}).webp({quality:84}).toFile(path.join(output,name+'-still.webp'));
}
(async()=>{
  const atlas=process.argv[2], {width}=await sharp(atlas).metadata();
  fs.mkdirSync(output,{recursive:true});
  for(const [i,pose] of ['idle','wave','stretch','sleep'].entries()) await bake(pose,i,atlas,width/2);
})().catch(e=>{console.error(e);process.exitCode=1;});
