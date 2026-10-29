import { createDecipheriv, createHash } from "node:crypto";
import { readFileSync, writeFileSync } from "node:fs";

const [file,flag]=process.argv.slice(2);const secret=process.env.BACKUP_ENCRYPTION_KEY;
if(!file||!secret||secret.length<32){console.error("Usage: BACKUP_ENCRYPTION_KEY=... node scripts/inspect-backup.mjs <backup.bin> [--extract]");process.exit(1);}
const input=readFileSync(file);if(input.subarray(0,8).toString()!=="DIINIBK1")throw new Error("Invalid DIINI backup file");
const key=createHash("sha256").update(secret).digest();const iv=input.subarray(8,20);const tag=input.subarray(20,36);const decipher=createDecipheriv("aes-256-gcm",key,iv);decipher.setAuthTag(tag);const plain=Buffer.concat([decipher.update(input.subarray(36)),decipher.final()]);const backup=JSON.parse(plain.toString("utf8"));
console.log(JSON.stringify({format:backup.format,generated_at:backup.generated_at,manifest:backup.manifest},null,2));
if(flag==="--extract"){const output=`${file}.json`;writeFileSync(output,JSON.stringify(backup,null,2),{mode:0o600});console.log(`Decrypted backup written to ${output}`);}

