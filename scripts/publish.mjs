import { execFileSync } from "node:child_process";

const message = process.argv.slice(2).join(" ").trim();
const commitMessage = message || `Actualizar sitio ${new Date().toISOString().slice(0, 10)}`;

const run = (command, args) => {
  execFileSync(command, args, { stdio: "inherit" });
};

const status = execFileSync("git", ["status", "--short"], { encoding: "utf8" }).trim();

if (!status) {
  console.log("No hay cambios para publicar.");
  process.exit(0);
}

run("git", ["add", "-A"]);
run("git", ["commit", "-m", commitMessage]);
run("git", ["push", "origin", "main"]);
