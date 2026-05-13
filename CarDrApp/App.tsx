import React, {useEffect, useState} from 'react';
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

type DtcCode = {
  moduleName: string;
  code: string;
};

function App(): React.JSX.Element {

  const [dtcCodes, setDtcCodes] = useState<DtcCode[]>([]);
  const [progress, setProgress] = useState("0");

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
      console.error("❌ CarDrModule not found in NativeModules");
      console.log("NativeModules:", NativeModules);
      return;
    }

    console.log("✅ CarDrModule loaded:", CarDrModule);

    const emitter = new NativeEventEmitter(CarDrModule);

    const vinListener = emitter.addListener(
      "onVINReceived",
      data => {
        console.log("VIN:", data.vin);
        Alert.alert("VIN Received", data.vin);
      }
    );

    const progressListener = emitter.addListener(
      "onScanProgress",
      data => {
        console.log("Progress:", data.percent);
        setProgress(data.percent);
      }
    );

    const dtcListener = emitter.addListener(
      "onDTCReceived",
      data => {
        console.log("DTC Codes:", data.codes);
        setDtcCodes(data.codes || []);
      }
    );

    const repairListener = emitter.addListener(
      "onRepairCostReceived",
      data => {
        console.log("Repair Cost:", data.result);
      }
    );

    return () => {
      vinListener.remove();
      progressListener.remove();
      dtcListener.remove();
      repairListener.remove();
    };

  }, []);

  const initializeSDK = async () => {
    const hasPermission = await requestBluetoothPermissions();
    if (!hasPermission) {
      return;
    }

    CarDrModule?.initializeSDK("CARDR-58748");
  };

  const scanDevice = async () => {
    const hasPermission = await requestBluetoothPermissions();
    if (!hasPermission) {
      return;
    }

    CarDrModule?.scanForDevice();
  };

  const startScan = async () => {
    const hasPermission = await requestBluetoothPermissions();
    if (!hasPermission) {
      return;
    }

    setDtcCodes([]);
    setProgress("0");
    CarDrModule?.startScan();
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
          title="Initialize SDK"
          onPress={initializeSDK}
        />

        <View style={{height: 20}} />

        <Button
          title="Scan Device"
          onPress={scanDevice}
        />

        <View style={{height: 20}} />

        <Button
          title="Start Scan"
          onPress={startScan}
        />

        {/* Scan Progress */}
        <Text style={styles.progressText}>
          Scan Progress: {progress}%
        </Text>

        {/* DTC Codes */}
        <View style={{marginTop: 30}}>
          <Text style={styles.listTitle}>Detected Error Codes</Text>

          <FlatList
            data={dtcCodes}
            keyExtractor={(item, index) => index.toString()}
            renderItem={renderItem}
            ListEmptyComponent={
              <Text style={{textAlign: 'center', marginTop: 10}}>
                No codes yet
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
    justifyContent: 'center',
    backgroundColor: '#f2f2f2',
  },

  content: {
    paddingHorizontal: 24,
  },

  title: {
    fontSize: 22,
    fontWeight: '600',
    marginBottom: 40,
    textAlign: 'center',
  },

  progressText: {
    marginTop: 20,
    fontSize: 16,
    textAlign: 'center',
    fontWeight: '500',
  },

  listTitle: {
    fontSize: 18,
    fontWeight: '600',
    marginBottom: 10,
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
});

export default App;
