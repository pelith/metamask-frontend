import PropTypes from 'prop-types'
import React, { Component } from 'react'
import PermissionsConnectHeader from './permissions-connect-header'
import PermissionsConnectFooter from './permissions-connect-footer'
import ChooseAccount from './choose-account'
import { getEnvironmentType } from '../../../../app/scripts/lib/util'
import {
  ENVIRONMENT_TYPE_FULLSCREEN,
  ENVIRONMENT_TYPE_NOTIFICATION,
  ENVIRONMENT_TYPE_POPUP,
} from '../../../../app/scripts/lib/enums'
import { DEFAULT_ROUTE, CONNECTED_ROUTE } from '../../helpers/constants/routes'
import PermissionPageContainer from '../../components/app/permission-page-container'

export default class PermissionConnect extends Component {
  static propTypes = {
    approvePermissionsRequest: PropTypes.func.isRequired,
    rejectPermissionsRequest: PropTypes.func.isRequired,
    getRequestAccountTabIds: PropTypes.func.isRequired,
    getCurrentWindowTab: PropTypes.func.isRequired,
    accounts: PropTypes.array.isRequired,
    originName: PropTypes.string,
    showNewAccountModal: PropTypes.func.isRequired,
    newAccountNumber: PropTypes.number.isRequired,
    nativeCurrency: PropTypes.string,
    permissionsRequest: PropTypes.object,
    addressLastConnectedMap: PropTypes.object,
    requestAccountTabs: PropTypes.object,
    permissionsRequestId: PropTypes.string,
    domains: PropTypes.object,
    history: PropTypes.object.isRequired,
  }

  static defaultProps = {
    originName: '',
    nativeCurrency: '',
    permissionsRequest: undefined,
    addressLastConnectedMap: {},
    requestAccountTabs: {},
    permissionsRequestId: '',
    domains: {},
  }

  static contextTypes = {
    t: PropTypes.func,
  }

  state = {
    page: 1,
    selectedAccountAddress: '',
    permissionAccepted: null,
    originName: this.props.originName,
  }

  beforeUnload = () => {
    const { permissionsRequestId, rejectPermissionsRequest } = this.props
    const { permissionAccepted } = this.state

    if (permissionAccepted === null && permissionsRequestId) {
      rejectPermissionsRequest(permissionsRequestId)
    }
  }

  removeBeforeUnload = () => {
    if (getEnvironmentType() === ENVIRONMENT_TYPE_FULLSCREEN) {
      window.removeEventListener('beforeunload', this.beforeUnload)
    }
  }

  componentDidUpdate (prevProps) {
    const { domains, permissionsRequest } = this.props
    const { originName, page } = this.state

    if (!permissionsRequest && prevProps.permissionsRequest && page !== null) {
      const permissionDataForDomain = domains && domains[originName] || {}
      const permissionsForDomain = permissionDataForDomain.permissions || []
      const prevPermissionDataForDomain = prevProps.domains && prevProps.domains[originName] || {}
      const prevPermissionsForDomain = prevPermissionDataForDomain.permissions || []
      const addedAPermission = permissionsForDomain.length > prevPermissionsForDomain.length
      if (addedAPermission) {
        this.redirectFlow(true)
      } else {
        this.redirectFlow(false)
      }
    }
  }

  selectAccount = (address) => {
    this.setState({
      page: 2,
      selectedAccountAddress: address,
    })
  }

  redirectFlow (accepted) {
    const { requestAccountTabs, history } = this.props
    const { originName } = this.state

    this.setState({
      page: null,
      permissionAccepted: accepted,
    })
    this.removeBeforeUnload()

    if (getEnvironmentType() === ENVIRONMENT_TYPE_FULLSCREEN) {
      setTimeout(async () => {
        const currentTab = await global.platform.currentTab()
        try {
          console.log('redirectFlow', requestAccountTabs[originName])
          if (currentTab.active) {
            await global.platform.switchToTab(requestAccountTabs[originName])
          }
        } finally {
          global.platform.closeTab(currentTab.id)
        }
      }, 2000)
    } else if (getEnvironmentType() === ENVIRONMENT_TYPE_NOTIFICATION) {
      history.push(DEFAULT_ROUTE)
    } else if (getEnvironmentType() === ENVIRONMENT_TYPE_POPUP) {
      history.push(CONNECTED_ROUTE)
    }
  }

  componentDidMount () {
    const {
      getCurrentWindowTab,
      getRequestAccountTabIds,
      permissionsRequest,
      history,
    } = this.props
    getCurrentWindowTab()
    getRequestAccountTabIds()

    if (!permissionsRequest) {
      return history.push(DEFAULT_ROUTE)
    }

    if (getEnvironmentType() === ENVIRONMENT_TYPE_FULLSCREEN) {
      window.addEventListener('beforeunload', this.beforeUnload)
    }
  }

  render () {
    const {
      approvePermissionsRequest,
      rejectPermissionsRequest,
      accounts,
      showNewAccountModal,
      newAccountNumber,
      nativeCurrency,
      permissionsRequest,
      addressLastConnectedMap,
      permissionsRequestId,
    } = this.props
    const { page, selectedAccountAddress, permissionAccepted, originName } = this.state

    return (
      <div className="permissions-connect">
        { page !== null
          ? <PermissionsConnectHeader page={page} />
          : null
        }
        { page === 1
          ? (
            <ChooseAccount
              accounts={accounts}
              originName={originName}
              nativeCurrency={nativeCurrency}
              selectAccount={(address) => this.selectAccount(address)}
              selectNewAccountViaModal={() => {
                showNewAccountModal({
                  onCreateNewAccount: this.selectAccount,
                  newAccountNumber,
                })
              }}
              addressLastConnectedMap={addressLastConnectedMap}
              cancelPermissionsRequest={requestId => {
                if (requestId) {
                  rejectPermissionsRequest(requestId)
                  this.redirectFlow(false)
                }
              }}
              permissionsRequestId={permissionsRequestId}
            />
          )
          : (
            <div>
              <PermissionPageContainer
                request={permissionsRequest || {}}
                approvePermissionsRequest={(request, accounts) => {
                  approvePermissionsRequest(request, accounts)
                  this.redirectFlow(true)
                }}
                rejectPermissionsRequest={requestId => {
                  rejectPermissionsRequest(requestId)
                  this.redirectFlow(false)
                }}
                selectedIdentity={accounts.find(account => account.address === selectedAccountAddress)}
                redirect={page === null}
                permissionRejected={ permissionAccepted === false }
              />
              <PermissionsConnectFooter />
            </div>
          )
        }
      </div>
    )
  }
}
