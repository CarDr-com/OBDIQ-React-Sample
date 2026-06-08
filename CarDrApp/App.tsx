import React, {useCallback, useEffect, useRef, useState} from 'react';
import {
  SafeAreaView,
  StatusBar,
  StyleSheet,
  Text,
  View,
  Button,
  NativeModules,
  NativeEventEmitter,
  Alert,
  FlatList,
  PermissionsAndroid,
  Platform,
} from 'react-native';

const {CarDrModule} = NativeModules;
const GENERIC_SCAN_DELAY_MS = 5000;

type DtcCode = {
  moduleName: string;
  code: string;
};

type ReadyForScanEvent = {
  status: boolean;
  isGeneric: boolean;
};

type ReadyForRepairInfoEvent = {
  isReady: boolean;
};

type BluetoothStateEvent = {
  status: boolean;
};

function App(): React.JSX.Element {

  const [dtcCodes, setDtcCodes] = useState<DtcCode[]>([]);
  const [progress, setProgress] = useState('0');
  const [scanCompleted, setScanCompleted] = useState(false);
  const [vin, setVin] = useState('');
  const [isRepairInfoReady, setIsRepairInfoReady] = useState(false);
  const [isRepairCostLoading, setIsRepairCostLoading] = useState(false);
  const readyForScanTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const hasStartedReadyScanRef = useRef(false);
  const hasStartedDeviceScanRef = useRef(false);

  const clearReadyForScanDelay = useCallback(() => {
    if (readyForScanTimeoutRef.current) {
      clearTimeout(readyForScanTimeoutRef.current);
      readyForScanTimeoutRef.current = null;
    }
  }, []);

  const resetReadyForScanState = useCallback(() => {
    clearReadyForScanDelay();
    hasStartedReadyScanRef.current = false;
    hasStartedDeviceScanRef.current = false;
  }, [clearReadyForScanDelay]);

  const scanForDeviceWhenReady = useCallback(() => {
    if (hasStartedDeviceScanRef.current) {
      return;
    }

    hasStartedDeviceScanRef.current = true;
    CarDrModule?.scanForDevice();
  }, []);

  const startScanFromReadyCallback = useCallback((isGeneric = false) => {
    if (hasStartedReadyScanRef.current) {
      return;
    }

    clearReadyForScanDelay();
    hasStartedReadyScanRef.current = true;
    setDtcCodes([]);
    setScanCompleted(false);
    setProgress('0');
    setIsRepairInfoReady(false);
    setIsRepairCostLoading(false);

    if (Platform.OS === 'android') {
      if (isGeneric) {
        console.log('Starting Android generic scan');
        CarDrModule?.startGenericScan?.();
        return;
      }

      console.log('Starting Android advanced scan');
      CarDrModule?.startAdvancedScan?.();
      return;
    }

    CarDrModule?.startScan();
  }, [clearReadyForScanDelay]);

  const requestBluetoothPermissions = async () => {
    if (Platform.OS !== 'android') {
      return true;
    }

    try {
      const permissions =
        Platform.Version >= 31
          ? [
              PermissionsAndroid.PERMISSIONS.BLUETOOTH_SCAN,
              PermissionsAndroid.PERMISSIONS.BLUETOOTH_CONNECT,
            ]
          : [PermissionsAndroid.PERMISSIONS.ACCESS_FINE_LOCATION];

      const result = await PermissionsAndroid.requestMultiple(permissions);

      const granted = permissions.every(
        permission => result[permission] === PermissionsAndroid.RESULTS.GRANTED,
      );

      if (!granted) {
        Alert.alert(
          'Bluetooth Permission Required',
          'Please allow Bluetooth permissions to scan and connect to your OBD device.',
        );
      }

      return granted;
    } catch (error) {
      console.error('Bluetooth permission request failed:', error);
      Alert.alert(
        'Permission Error',
        'Unable to request Bluetooth permissions. Please enable them in Settings.',
      );
      return false;
    }
  };

  useEffect(() => {

    if (!CarDrModule) {
      console.error('❌ CarDrModule not found in NativeModules');
      console.log('NativeModules:', NativeModules);
      return;
    }

    console.log('✅ CarDrModule loaded:', CarDrModule);

    const emitter = new NativeEventEmitter(CarDrModule);

    const vinListener = emitter.addListener(
      'onVINReceived',
      data => {
        console.log('VIN:', data.vin);
        setVin(data.vin || '');
      }
    );

    const progressListener = emitter.addListener(
      'onScanProgress',
      data => {
        console.log('Progress:', data.percent);
        if (data.percent !== undefined && data.percent !== '') {
          setProgress(data.percent);
        }

        if (data.status === 'ScanSucceeded') {
          setProgress('100');
          setScanCompleted(true);
        }
      }
    );

    const bluetoothStateListener = emitter.addListener(
      'onBluetoothState',
      (data: BluetoothStateEvent) => {
        console.log('Bluetooth state:', data);

        if (Platform.OS === 'android' && data.status) {
          scanForDeviceWhenReady();
        }
      }
    );

    const readyForScanListener = emitter.addListener(
      'onReadyForScan',
      (data: ReadyForScanEvent) => {
        console.log('Ready for scan:', data);

        if (!data.status) {
          return;
        }

        if (data.isGeneric === true) {
          if (!hasStartedReadyScanRef.current && !readyForScanTimeoutRef.current) {
            readyForScanTimeoutRef.current = setTimeout(
              () => startScanFromReadyCallback(true),
              GENERIC_SCAN_DELAY_MS,
            );
          }
          return;
        }

        startScanFromReadyCallback(false);
      }
    );

    const dtcListener = emitter.addListener(
      'onDTCReceived',
      data => {
        console.log('DTC Codes:', data.codes);
        setDtcCodes(data.codes || []);
        setScanCompleted(true);
      }
    );

    const repairListener = emitter.addListener(
      'onRepairCostReceived',
      data => {
        console.log('Repair Cost:', data.result);
        setIsRepairCostLoading(false);
      }
    );

    const readyForRepairInfoListener = emitter.addListener(
      'onReadyForRepairInfo',
      (data: ReadyForRepairInfoEvent) => {
        console.log('Ready for repair info:', data.isReady);
        setIsRepairInfoReady(data.isReady === true);
      }
    );

    return () => {
      vinListener.remove();
      progressListener.remove();
      bluetoothStateListener.remove();
      readyForScanListener.remove();
      dtcListener.remove();
      repairListener.remove();
      readyForRepairInfoListener.remove();
      clearReadyForScanDelay();
    };

  }, [clearReadyForScanDelay, scanForDeviceWhenReady, startScanFromReadyCallback]);

  const connect = async () => {
    const hasPermission = await requestBluetoothPermissions();
    if (!hasPermission) {
      return;
    }

    resetReadyForScanState();
    setVin('');
    setDtcCodes([]);
    setScanCompleted(false);
    setProgress('0');
    setIsRepairInfoReady(false);
    setIsRepairCostLoading(false);
    CarDrModule?.initializeSDK('CARDR-58748');

    if (Platform.OS !== 'android') {
      scanForDeviceWhenReady();
    }
  };

  const getRepairCost = () => {
    if (!isRepairInfoReady || isRepairCostLoading) {
      return;
    }

    setIsRepairCostLoading(true);
    CarDrModule?.getRepairCost?.(vin, dtcCodes);
  };

  const renderItem = ({item}: {item: DtcCode}) => (
    <View style={styles.codeItem}>
      <Text style={styles.codeText}>
        {item.moduleName} - {item.code}
      </Text>
    </View>
  );

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="dark-content" />

      <View style={styles.content}>

        <Text style={styles.title}>CarDr OBD SDK Demo</Text>

        <Button
          title="Connect"
          onPress={connect}
        />

        <View style={styles.sectionGap} />

        <Text style={styles.progressText}>
          Scan Progress: {progress}%
        </Text>

        <Text style={styles.vinText}>
          VIN: {vin || 'Not received yet'}
        </Text>

        <View style={styles.repairButton}>
          <Button
            title={isRepairCostLoading ? 'Getting Repair Cost...' : 'Get Repair Cost'}
            onPress={getRepairCost}
            disabled={!isRepairInfoReady || isRepairCostLoading}
          />
        </View>

        {/* DTC Codes */}
        <View style={styles.listSection}>
          <Text style={styles.listTitle}>Detected Error Codes</Text>

          <FlatList
            data={dtcCodes}
            keyExtractor={(item, index) => index.toString()}
            renderItem={renderItem}
            style={styles.codesList}
            contentContainerStyle={[
              styles.codesListContent,
              dtcCodes.length === 0 && styles.emptyCodesListContent,
            ]}
            showsVerticalScrollIndicator={true}
            ListEmptyComponent={
              <Text style={styles.emptyText}>
                {scanCompleted ? 'No error codes found' : 'No codes yet'}
              </Text>
            }
          />
        </View>

      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({

  container: {
    flex: 1,
    backgroundColor: '#f2f2f2',
  },

  content: {
    flex: 1,
    paddingHorizontal: 24,
    paddingTop: 48,
    paddingBottom: 24,
  },

  title: {
    fontSize: 22,
    fontWeight: '600',
    marginBottom: 40,
    textAlign: 'center',
  },

  sectionGap: {
    height: 20,
  },

  progressText: {
    marginTop: 20,
    fontSize: 16,
    textAlign: 'center',
    fontWeight: '500',
  },

  vinText: {
    marginTop: 10,
    fontSize: 14,
    textAlign: 'center',
    fontWeight: '500',
  },

  repairButton: {
    marginTop: 16,
  },

  listTitle: {
    fontSize: 18,
    fontWeight: '600',
    marginBottom: 10,
  },

  listSection: {
    flex: 1,
    marginTop: 30,
    minHeight: 180,
  },

  codesList: {
    flex: 1,
  },

  codesListContent: {
    paddingBottom: 24,
  },

  emptyCodesListContent: {
    flexGrow: 1,
  },

  codeItem: {
    padding: 12,
    borderRadius: 8,
    backgroundColor: '#ffffff',
    marginBottom: 10,
    elevation: 2,
  },

  codeText: {
    fontSize: 16,
  },

  emptyText: {
    marginTop: 10,
    textAlign: 'center',
  },
});

export default App;
