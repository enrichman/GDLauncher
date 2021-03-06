// @flow
import React, { Component } from 'react';
import { message, Icon } from 'antd';
import psTree from 'ps-tree';
import { ContextMenu, MenuItem, ContextMenuTrigger } from 'react-contextmenu';
import fsa from 'fs-extra';
import path from 'path';
import fs from 'fs';
import os from 'os';
import log from 'electron-log';
import { promisify } from 'util';
import { exec } from 'child_process';
import { hideMenu } from 'react-contextmenu/es6/actions';
import { PACKS_PATH, APPPATH } from '../../constants';
import { history } from '../../store/configureStore';
import styles from './DInstance.scss';

type Props = {
  name: string,
  installingQueue: Object,
  selectedInstance: ?string,
  startInstance: () => void,
  selectInstance: () => void,
  playing: Array
};

export default class DInstance extends Component<Props> {
  props: Props;

  constructor(props) {
    super(props);
    this.state = {
      deleting: false,
      version: null
    };
    this.percentage = this.updatePercentage();
  }

  componentDidMount = async () => {
    if (!this.isInstalling()) {
      this.setState({
        version: JSON.parse(
          await promisify(fs.readFile)(
            path.join(PACKS_PATH, this.props.name, 'config.json')
          )
        ).version
      });
    }
  };

  componentDidUpdate = () => {
    this.percentage = this.updatePercentage();
  };

  isInstalling() {
    if (this.props.installingQueue[this.props.name]) {
      switch (this.props.installingQueue[this.props.name].status) {
        case 'Queued':
          return true;
        case 'Downloading':
          return true;
        case 'Completed':
          return false;
        default:
          return true;
      }
    } else {
      return false;
    }
  }

  updatePercentage() {
    const { percentage } = this.props.installingQueue[this.props.name] || 0;
    if (this.props.installingQueue[this.props.name]) {
      switch (this.props.installingQueue[this.props.name].status) {
        case 'Queued':
          return 0;
        case 'Downloading':
          // If the total file to download is equal to 0 (not yet sent from the worker) then show 0 to avoid NaN from 0 / 0
          return percentage;
        case 'Completed':
          return 100;
        default:
          return 0;
      }
    } else {
      return 0;
    }
  }

  handleClickPlay = async e => {
    if (!this.isInstalling()) {
      e.stopPropagation();
      if (this.props.playing.find(el => el.name === this.props.name)) {
        psTree(
          this.props.playing.find(el => el.name === this.props.name).pid,
          (err, children) => {
            children.forEach(el => {
              process.kill(el.PID);
            });
          }
        );
        message.info('Instance terminated');
      } else {
        this.props.startInstance(this.props.name);
        this.props.selectInstance(this.props.name);
      }
    }
  };

  deleteInstance = async () => {
    try {
      this.setState({ deleting: true });
      await fsa.remove(path.join(PACKS_PATH, this.props.name));
      this.props.selectInstance(null);
      message.success('Instance deleted');
    } catch (err) {
      hideMenu(`contextMenu-${this.props.name}`);
      message.error('Error deleting instance');
      log.error(err);
    } finally {
      this.setState({ deleting: false });
    }
  };

  render() {
    const { name } = this.props;
    return (
      <div
        className={`${
          this.props.selectedInstance === name ? styles.selectedItem : ''
        } ${styles.main}`}
      >
        <ContextMenuTrigger id={`contextMenu-${name}`}>
          <div
            className={styles.innerMain}
            onMouseEnter={() =>
              document.documentElement.style.setProperty(
                '--instanceName',
                `"${name}"`
              )
            }
            onClick={e => {
              e.stopPropagation();
              this.props.selectInstance(name);
            }}
            onDoubleClick={this.handleClickPlay}
            onKeyPress={this.handleKeyPress}
            role="button"
            tabIndex={0}
          >
            {this.props.playing.find(el => el.name === name) && (
              <span className={styles.playingIcon}>
                <i className="fas fa-play" style={{ fontSize: '17px' }} />
              </span>
            )}
            {this.isInstalling() && (
              <Icon
                className={styles.icon__iconState}
                type="loading"
                theme="outlined"
              />
            )}
            <div className={styles.icon}>
              <div
                className={styles.icon__image}
                style={{
                  filter: this.isInstalling()
                    ? "url(\"data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg'><filter id='grayscale'><feColorMatrix type='matrix' values='0.3333 0.3333 0.3333 0 0 0.3333 0.3333 0.3333 0 0 0.3333 0.3333 0.3333 0 0 0 0 0 1 0'/></filter></svg>#grayscale\")"
                    : ''
                }}
              />
              <span className={styles.icon__instanceNameContainer}>
                <span
                  className={styles.icon__instanceName}
                  style={{ width: this.isInstalling() ? '76px' : '130px' }}
                >
                  {name}
                </span>
                <span className={styles.icon__instancePercentage}>
                  {this.isInstalling() && ` (${this.updatePercentage()}%)`}
                </span>
              </span>
            </div>
          </div>
        </ContextMenuTrigger>
        <ContextMenu
          id={`contextMenu-${name}`}
          onShow={e => {
            e.stopPropagation();
            this.props.selectInstance(name);
          }}
        >
          <span>
            {name} ({this.state.version})
          </span>
          <MenuItem
            disabled={this.isInstalling() || this.state.deleting}
            onClick={this.handleClickPlay}
          >
            {this.props.playing.find(el => el.name === name) ? (
              <div>
                <Icon type="thunderbolt" theme="filled" /> Kill
              </div>
            ) : (
              <div>
                <Icon type="play-circle" theme="filled" /> Launch
              </div>
            )}
          </MenuItem>
          <MenuItem
            disabled={this.isInstalling() || this.state.deleting}
            data={{ foo: 'bar' }}
            onClick={() =>
              history.push({
                pathname: `/editInstance/${name}/settings/`,
                state: { modal: true }
              })
            }
          >
            <Icon type="tool" theme="filled" /> Manage
          </MenuItem>
          <MenuItem
            onClick={() => exec(`start "" "${path.join(PACKS_PATH, name)}"`)}
          >
            <Icon type="folder" theme="filled" /> Open Folder
          </MenuItem>
          <MenuItem
            onClick={() => {
              exec(
                `powershell $s=(New-Object -COM WScript.Shell).CreateShortcut('%userprofile%\\Desktop\\${
                  this.props.name
                }.lnk');$s.TargetPath='${path.join(
                  APPPATH,
                  'GDLauncher.exe'
                )}';$s.Arguments='-i ${this.props.name}';$s.Save()`,
                error => {
                  if (error) {
                    log.error(`Error creating instance symlink: ${error}`);
                    message.error(
                      <span>
                        Error while crerating the shortcut. Click{' '}
                        <a
                          href="https://github.com/gorilla-devs/GDLauncher/wiki/Error-while-creating-an-instance's-shortcut"
                          target="_blank"
                          rel="noopener noreferrer"
                        >
                          here
                        </a>{' '}
                        to know more
                      </span>
                    );
                  }
                }
              );
            }}
            disabled={this.isInstalling() || process.platform !== 'win32' || this.state.deleting}
          >
            <Icon type="link" theme="outlined" /> Create Shortcut
          </MenuItem>
          <MenuItem
            disabled={this.isInstalling() || this.state.deleting}
            onClick={() => exec(`start "" "${path.join(PACKS_PATH, name)}"`)}
          >
            <Icon type="export" theme="outlined" /> Export Instance
          </MenuItem>
          <MenuItem
            disabled={this.isInstalling() || this.state.deleting}
            data={{ foo: 'bar' }}
            onClick={this.deleteInstance}
            preventClose
          >
            {this.state.deleting ? (
              <div>
                <Icon type="loading" theme="outlined" /> Deleting...
              </div>
            ) : (
              <div>
                <Icon type="delete" theme="filled" /> Delete
              </div>
            )}
          </MenuItem>
        </ContextMenu>
      </div>
    );
  }
}
