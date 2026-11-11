import {DatabaseSync} from 'node:sqlite';
import {mkdir,readFile} from 'node:fs/promises';
import {ProfileStore} from './profiles.mjs';
import {D1Store} from './api.mjs';
import {SocialStore} from './social.mjs';
export async function localProfileStore(directory=new URL('../.local/',import.meta.url)){
  await mkdir(directory,{recursive:true});
  const db=new DatabaseSync(new URL('profiles.sqlite',directory));
  // Local rooms and receipts use the same database transaction as hosted D1.
  db.exec('CREATE TABLE IF NOT EXISTS rush_rooms (code TEXT PRIMARY KEY NOT NULL,version INTEGER NOT NULL,state TEXT NOT NULL,touched INTEGER NOT NULL)');
  for(const file of ['0001_profiles.sql','0002_match_results.sql','0003_profile_recovery.sql','0004_social.sql','0005_room_invites.sql'])db.exec(await readFile(new URL('../drizzle/'+file,import.meta.url),'utf8'));
  const binding={prepare(sql){return {bind(...args){return {first:()=>db.prepare(sql).get(...args),all:()=>({results:db.prepare(sql).all(...args)}),run:()=>({meta:db.prepare(sql).run(...args)})};}};}};
  return {store:new ProfileStore(binding),rooms:new D1Store(binding),social:new SocialStore(binding),close:()=>db.close()};
}
