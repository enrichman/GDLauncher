import os from 'os';
import {
  LINUX,
  WINDOWS,
  DARWIN
} from '../constants';

const findJavaHome = async () => {
  const util = require('util');
  const exec = util.promisify(require('child_process').exec);
  let command = null;
  switch (os.platform()) {
    case LINUX:
    case DARWIN:
      command = 'which javaw';
      break;
    case WINDOWS:
      command = 'where javaw';
      break;
    default:
      break;
  }
  const { stdout } = await exec(command);
  // This returns the first path found
  return stdout.split('\n')[0];
};

export default findJavaHome;
